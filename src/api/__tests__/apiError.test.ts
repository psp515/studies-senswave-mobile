import { apiErrorMessage, connectionApiError } from "@/api/apiError";

describe("apiErrorMessage", () => {
    it("uses the first error description", () => {
        expect(
            apiErrorMessage({
                statusText: "Bad Request",
                errors: [
                    { code: "Device.NameTooLong", description: "Name is too long." },
                    { code: "Other", description: "Other." },
                ],
            }),
        ).toBe("Name is too long.");
    });

    it("falls back to the code when the description is empty", () => {
        expect(
            apiErrorMessage({
                statusText: "",
                errors: [{ code: "Device.Missing", description: "" }],
            }),
        ).toBe("Device.Missing");
    });

    it("uses the generic message when there are no errors", () => {
        expect(apiErrorMessage({ statusText: "Bad Request", errors: [] })).toBe(
            "An unexpected error occurred.",
        );
    });

    it("has a connection error constant", () => {
        expect(connectionApiError.errors).toEqual([]);
    });
});
