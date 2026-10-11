export type GrpcFailureKind =
    | "refreshAndRetry"
    | "emailNotConfirmed"
    | "invalidCredentials"
    | "consentMissing"
    | "homeAccessDenied"
    | "requestFailed"
    | "connectionError"
    | "timeout";

export interface GrpcFailureInput {
    code: string;
    serviceTypeName: string;
    methodName: string;
    detail: string;
}

const authService = "senswave.users.v1.AuthService";
const legalService = "senswave.users.v1.LegalService";
const liveUpdatesService = "senswave.liveupdates.v1.LiveUpdatesService";

// Packages LegalConsentInterceptor never checks (users, auth, legal, live updates).
const consentExemptPackages = ["senswave.users.v1.", "senswave.liveupdates.v1."];

export const isAnonymousService = (serviceTypeName: string): boolean =>
    serviceTypeName === authService || serviceTypeName === legalService;

/** Maps a failed gRPC call to the app behavior its REST equivalent triggers today. */
export const classifyGrpcFailure = ({
    code,
    serviceTypeName,
    methodName,
    detail,
}: GrpcFailureInput): GrpcFailureKind => {
    switch (code) {
        case "UNAUTHENTICATED":
            if (serviceTypeName !== authService) {
                return "refreshAndRetry";
            }
            if (methodName === "Login") {
                return detail === "NotAllowed" ? "emailNotConfirmed" : "invalidCredentials";
            }
            return "requestFailed";
        case "PERMISSION_DENIED":
            if (serviceTypeName === liveUpdatesService) {
                return "homeAccessDenied";
            }
            if (consentExemptPackages.some((p) => serviceTypeName.startsWith(p))) {
                return "requestFailed";
            }
            return "consentMissing";
        case "UNAVAILABLE":
            return "connectionError";
        case "DEADLINE_EXCEEDED":
            return "timeout";
        default:
            return "requestFailed";
    }
};
