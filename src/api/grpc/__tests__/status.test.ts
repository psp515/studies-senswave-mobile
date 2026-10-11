import { classifyGrpcFailure, isAnonymousService } from "@/api/grpc/status";

const input = (code: string, serviceTypeName: string, methodName = "Any", detail = "") => ({
    code,
    serviceTypeName,
    methodName,
    detail,
});

describe("classifyGrpcFailure", () => {
    it.each([
        [input("UNAUTHENTICATED", "senswave.devices.v1.DevicesService"), "refreshAndRetry"],
        [input("UNAUTHENTICATED", "senswave.users.v1.UsersService"), "refreshAndRetry"],
        [
            input("UNAUTHENTICATED", "senswave.users.v1.AuthService", "Login", "NotAllowed"),
            "emailNotConfirmed",
        ],
        [
            input("UNAUTHENTICATED", "senswave.users.v1.AuthService", "Login", "Failed"),
            "invalidCredentials",
        ],
        [
            input("UNAUTHENTICATED", "senswave.users.v1.AuthService", "Login", "LockedOut"),
            "invalidCredentials",
        ],
        [input("UNAUTHENTICATED", "senswave.users.v1.AuthService", "Refresh"), "requestFailed"],
        [input("PERMISSION_DENIED", "senswave.devices.v1.DevicesService"), "consentMissing"],
        [input("PERMISSION_DENIED", "senswave.homes.v1.HomesService"), "consentMissing"],
        [
            input("PERMISSION_DENIED", "senswave.liveupdates.v1.LiveUpdatesService", "Subscribe"),
            "homeAccessDenied",
        ],
        [input("PERMISSION_DENIED", "senswave.users.v1.UsersService"), "requestFailed"],
        [input("INVALID_ARGUMENT", "senswave.devices.v1.DevicesService"), "requestFailed"],
        [input("FAILED_PRECONDITION", "senswave.devices.v1.DevicesService"), "requestFailed"],
        [input("NOT_FOUND", "senswave.devices.v1.DevicesService"), "requestFailed"],
        [input("ALREADY_EXISTS", "senswave.devices.v1.DevicesService"), "requestFailed"],
        [input("INTERNAL", "senswave.devices.v1.DevicesService"), "requestFailed"],
        [input("UNAVAILABLE", "senswave.devices.v1.DevicesService"), "connectionError"],
        [input("DEADLINE_EXCEEDED", "senswave.devices.v1.DevicesService"), "timeout"],
    ])("%o -> %s", (failure, expected) => {
        expect(classifyGrpcFailure(failure)).toBe(expected);
    });
});

describe("isAnonymousService", () => {
    it("is true for auth and legal only", () => {
        expect(isAnonymousService("senswave.users.v1.AuthService")).toBe(true);
        expect(isAnonymousService("senswave.users.v1.LegalService")).toBe(true);
        expect(isAnonymousService("senswave.users.v1.UsersService")).toBe(false);
        expect(isAnonymousService("senswave.devices.v1.DevicesService")).toBe(false);
    });
});
