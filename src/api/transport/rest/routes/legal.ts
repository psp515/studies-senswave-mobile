import { LegalService } from "@/api/gen/users/v1/legal_pb";
import { defineRoutes } from "../RestRoute";
import { asRecord, str, timestampFromIso } from "../converters";

const legalDocument = (json: unknown) => {
    const j = asRecord(json);
    return {
        id: str(j.id),
        version: str(j.version),
        summary: str(j.summary),
        content: str(j.content),
        createdAtUtc: timestampFromIso(j.createdAtUtc),
    };
};

export const legalRoutes = defineRoutes(LegalService, {
    getTermsAndConditions: { method: "GET", path: () => "v1/legal/terms", response: legalDocument },
    getPrivacyPolicy: { method: "GET", path: () => "v1/legal/privacy", response: legalDocument },
});
