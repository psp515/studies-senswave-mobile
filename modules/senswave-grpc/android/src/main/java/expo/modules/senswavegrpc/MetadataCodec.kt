package expo.modules.senswavegrpc

import android.util.Base64
import io.grpc.Metadata
import io.grpc.MethodDescriptor
import java.io.ByteArrayInputStream
import java.io.InputStream

/** Passes serialized protobuf bytes through untouched; JS owns (de)serialization. */
internal object ByteArrayMarshaller : MethodDescriptor.Marshaller<ByteArray> {
    override fun stream(value: ByteArray): InputStream = ByteArrayInputStream(value)
    override fun parse(stream: InputStream): ByteArray = stream.readBytes()
}

/** Converts between grpc-java Metadata and the bridge shape: lowercase keys, value lists, base64 for "-bin". */
internal object MetadataCodec {
    fun encode(bytes: ByteArray): String = Base64.encodeToString(bytes, Base64.NO_WRAP)

    fun decode(value: String): ByteArray = Base64.decode(value, Base64.NO_WRAP)

    fun fromMap(map: Map<String, List<String>>): Metadata {
        val metadata = Metadata()
        for ((rawKey, values) in map) {
            val key = rawKey.lowercase()
            if (key.endsWith(Metadata.BINARY_HEADER_SUFFIX)) {
                val binaryKey = Metadata.Key.of(key, Metadata.BINARY_BYTE_MARSHALLER)
                values.forEach { metadata.put(binaryKey, decode(it)) }
            } else {
                val asciiKey = Metadata.Key.of(key, Metadata.ASCII_STRING_MARSHALLER)
                values.forEach { metadata.put(asciiKey, it) }
            }
        }
        return metadata
    }

    fun toMap(metadata: Metadata): Map<String, List<String>> = metadata.keys().associateWith { key ->
        if (key.endsWith(Metadata.BINARY_HEADER_SUFFIX)) {
            metadata.getAll(Metadata.Key.of(key, Metadata.BINARY_BYTE_MARSHALLER))?.map(::encode) ?: emptyList()
        } else {
            metadata.getAll(Metadata.Key.of(key, Metadata.ASCII_STRING_MARSHALLER))?.toList() ?: emptyList()
        }
    }
}
