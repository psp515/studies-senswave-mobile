import { apiErrorFromProblemDetails } from "@/api/rest/problemDetails";

describe("apiErrorFromProblemDetails", () => {
    it("maps title, errors and traceId", () => {
        const text = JSON.stringify({
            statusCode: 400,
            title: "Bad Request",
            type: "Validation",
            errors: [{ code: "Home.Name", type: 2, description: "Name required." }],
            traceId: "abc",
        });

        expect(apiErrorFromProblemDetails(text)).toEqual({
            statusText: "Bad Request",
            errors: [{ code: "Home.Name", description: "Name required." }],
            traceId: "abc",
        });
    });

    it("treats a non-array errors field as no errors", () => {
        const text = JSON.stringify({
            title: "One or more validation errors occurred.",
            errors: { Name: ["x"] },
        });

        expect(apiErrorFromProblemDetails(text)).toEqual({
            statusText: "One or more validation errors occurred.",
            errors: [],
            traceId: undefined,
        });
    });

    it("returns null for invalid JSON", () => {
        expect(apiErrorFromProblemDetails("<html>")).toBeNull();
    });

    it("returns null for a JSON non-object", () => {
        expect(apiErrorFromProblemDetails("42")).toBeNull();
    });

    it("ignores null and non-object entries in errors", () => {
        const text = JSON.stringify({
            title: "Bad",
            errors: [null, 1, { code: "A", description: "d" }],
        });

        expect(apiErrorFromProblemDetails(text)?.errors).toEqual([{ code: "A", description: "d" }]);
    });
});
