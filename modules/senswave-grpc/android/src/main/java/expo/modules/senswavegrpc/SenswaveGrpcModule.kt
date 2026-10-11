package expo.modules.senswavegrpc

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import io.grpc.CallOptions
import io.grpc.ClientCall
import io.grpc.ManagedChannel
import io.grpc.Metadata
import io.grpc.MethodDescriptor
import io.grpc.Status
import io.grpc.okhttp.OkHttpChannelBuilder
import java.net.URI
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * Generic native gRPC client: JS sends serialized request bytes plus metadata for a full method
 * name, this module runs the call on a shared OkHttp channel and returns bytes, status and trailers.
 */
class SenswaveGrpcModule : Module() {
    private val channels = ConcurrentHashMap<String, ManagedChannel>()
    private val descriptors = ConcurrentHashMap<String, MethodDescriptor<ByteArray, ByteArray>>()
    private val calls = ConcurrentHashMap<String, ClientCall<ByteArray, ByteArray>>()

    override fun definition() = ModuleDefinition {
        Name("SenswaveGrpc")

        Events("onStreamHeaders", "onStreamMessage", "onStreamClose")

        AsyncFunction("unary") { callId: String, baseUrl: String, method: String, requestBase64: String,
                                 metadata: Map<String, List<String>>, deadlineMs: Double, promise: Promise ->
            var headers: Map<String, List<String>> = emptyMap()
            var response: ByteArray? = null

            val listener = object : ClientCall.Listener<ByteArray>() {
                override fun onHeaders(received: Metadata) {
                    headers = MetadataCodec.toMap(received)
                }

                override fun onMessage(message: ByteArray) {
                    response = message
                }

                override fun onClose(status: Status, trailers: Metadata) {
                    calls.remove(callId)
                    promise.resolve(
                        closeResult(status, trailers, headers) +
                            ("responseBase64" to response?.let(MetadataCodec::encode))
                    )
                }
            }

            startCall(callId, baseUrl, method, MethodDescriptor.MethodType.UNARY, requestBase64, metadata, deadlineMs, listener)
        }

        Function("startServerStream") { callId: String, baseUrl: String, method: String, requestBase64: String,
                                        metadata: Map<String, List<String>>, deadlineMs: Double ->
            var headers: Map<String, List<String>> = emptyMap()

            val listener = object : ClientCall.Listener<ByteArray>() {
                override fun onHeaders(received: Metadata) {
                    headers = MetadataCodec.toMap(received)
                    sendEvent("onStreamHeaders", mapOf("callId" to callId, "headers" to headers))
                }

                override fun onMessage(message: ByteArray) {
                    sendEvent("onStreamMessage", mapOf("callId" to callId, "base64" to MetadataCodec.encode(message)))
                    calls[callId]?.request(1)
                }

                override fun onClose(status: Status, trailers: Metadata) {
                    calls.remove(callId)
                    sendEvent("onStreamClose", closeResult(status, trailers, headers) + ("callId" to callId))
                }
            }

            startCall(callId, baseUrl, method, MethodDescriptor.MethodType.SERVER_STREAMING, requestBase64, metadata, deadlineMs, listener)
        }

        Function("cancel") { callId: String ->
            calls.remove(callId)?.cancel("Cancelled by client", null)
        }

        OnDestroy {
            calls.values.forEach { it.cancel("Module destroyed", null) }
            calls.clear()
            channels.values.forEach { it.shutdownNow() }
            channels.clear()
        }
    }

    private fun closeResult(status: Status, trailers: Metadata, headers: Map<String, List<String>>): Map<String, Any?> =
        mapOf(
            "status" to status.code.value(),
            "message" to (status.description ?: ""),
            "headers" to headers,
            "trailers" to MetadataCodec.toMap(trailers),
        )

    private fun startCall(
        callId: String,
        baseUrl: String,
        method: String,
        type: MethodDescriptor.MethodType,
        requestBase64: String,
        metadata: Map<String, List<String>>,
        deadlineMs: Double,
        listener: ClientCall.Listener<ByteArray>,
    ) {
        val call: ClientCall<ByteArray, ByteArray>
        val requestMetadata: Metadata
        val request: ByteArray

        try {
            var options = CallOptions.DEFAULT
            if (deadlineMs > 0) {
                options = options.withDeadlineAfter(deadlineMs.toLong(), TimeUnit.MILLISECONDS)
            }
            requestMetadata = MetadataCodec.fromMap(metadata)
            request = MetadataCodec.decode(requestBase64)
            call = channelFor(baseUrl).newCall(descriptorFor(method, type), options)
        } catch (e: Exception) {
            listener.onClose(Status.UNAVAILABLE.withDescription(e.message ?: "Failed to start call").withCause(e), Metadata())
            return
        }

        calls[callId] = call
        call.start(listener, requestMetadata)
        call.request(if (type == MethodDescriptor.MethodType.UNARY) 2 else 1)
        call.sendMessage(request)
        call.halfClose()
    }

    private fun descriptorFor(method: String, type: MethodDescriptor.MethodType): MethodDescriptor<ByteArray, ByteArray> =
        descriptors.getOrPut("$type:$method") {
            MethodDescriptor.newBuilder(ByteArrayMarshaller, ByteArrayMarshaller)
                .setType(type)
                .setFullMethodName(method)
                .build()
        }

    private fun channelFor(baseUrl: String): ManagedChannel {
        val uri = URI(baseUrl)
        val host = uri.host ?: throw IllegalArgumentException("Invalid base URL: $baseUrl")
        val port = if (uri.port != -1) uri.port else 443

        return channels.getOrPut("$host:$port") {
            // TLS through the platform trust manager, so network_security_config applies.
            OkHttpChannelBuilder.forAddress(host, port).useTransportSecurity().build()
        }
    }
}
