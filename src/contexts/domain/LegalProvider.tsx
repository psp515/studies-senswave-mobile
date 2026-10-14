import { call } from "@/api/call";
import type {
    GetPrivacyPolicyResponse,
    GetTermsAndConditionsResponse,
} from "@/api/gen/users/v1/legal_pb";
import { useAnonymousApi } from "@/contexts/AnonymousApiProvider";
import { isoFromTimestamp } from "@/api/json";
import { Result } from "@/utils/result";
import { createContext, FC, PropsWithChildren, useContext } from "react";

export interface LegalDocument {
    id: string;
    version: string;
    content: string;
    summary: string;
    createdAtUtc: string;
}

interface LegalContextProps {
    getTerms: () => Promise<Result<LegalDocument>>;
    getPrivacy: () => Promise<Result<LegalDocument>>;
}

const LegalContext = createContext<LegalContextProps>({
    getTerms: async () => Result.failure<LegalDocument>("Not implemented"),
    getPrivacy: async () => Result.failure<LegalDocument>("Not implemented"),
});

const ServiceUnavailableText = "Service unavailable";

const toLegalDocument = (
    r: GetPrivacyPolicyResponse | GetTermsAndConditionsResponse,
): LegalDocument => ({
    id: r.id,
    version: r.version,
    content: r.content,
    summary: r.summary,
    createdAtUtc: isoFromTimestamp(r.createdAtUtc),
});

export const LegalProvider: FC<PropsWithChildren> = ({ children }) => {
    const api = useAnonymousApi();

    const getTerms = async (): Promise<Result<LegalDocument>> => {
        const result = await call(
            () => api.legal.getTermsAndConditions({}),
            ServiceUnavailableText,
        );
        if (result.isSuccess) {
            console.info("[LegalProvider] Successfully fetched Terms and Conditions.");
            return Result.success(toLegalDocument(result.data!));
        }
        console.error("[LegalProvider] Failed to fetch Terms and Conditions.");
        return Result.failure<LegalDocument>(ServiceUnavailableText, result.error);
    };

    const getPrivacy = async (): Promise<Result<LegalDocument>> => {
        const result = await call(() => api.legal.getPrivacyPolicy({}), ServiceUnavailableText);
        if (result.isSuccess) {
            console.info("[LegalProvider] Successfully fetched Privacy Policy.");
            return Result.success(toLegalDocument(result.data!));
        }
        console.error("[LegalProvider] Failed to fetch Privacy Policy.");
        return Result.failure<LegalDocument>(ServiceUnavailableText, result.error);
    };

    console.info("[LegalProvider] Initialized.");

    return (
        <LegalContext.Provider
            value={{
                getTerms,
                getPrivacy,
            }}>
            {children}
        </LegalContext.Provider>
    );
};

export const useLegal = (): LegalContextProps => useContext(LegalContext);
