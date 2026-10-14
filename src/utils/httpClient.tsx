export interface HttpResponse {
    isSuccess: boolean;
    statusCode: number;
    response: Response | null;
}

export const executeTimeout = async (
    url: URL,
    options: RequestInit,
    timeoutMs: number = 10000,
): Promise<HttpResponse> => {
    const controller = new AbortController();
    const overrideOptions = { ...options, signal: controller.signal };

    let timeoutId: NodeJS.Timeout;

    const timeoutPromise = new Promise<HttpResponse>((resolve) => {
        timeoutId = setTimeout(() => {
            controller.abort();
            console.info(`[HttpClient] Request timed out after ${timeoutMs}ms`);
            resolve({
                isSuccess: false,
                statusCode: 408,
                response: null,
            });
        }, timeoutMs);
    });

    const fetchPromise = (async () => {
        try {
            // console.debug(`[HttpClient] Invoking request to ${url}`);
            const result = await fetch(url.toString(), overrideOptions);
            clearTimeout(timeoutId!);
            return {
                isSuccess: result.ok,
                statusCode: result.status,
                response: result,
            };
        } catch (error) {
            clearTimeout(timeoutId!);
            console.error(`[HttpClient] Failed to invoke request ${error}`);
            return {
                isSuccess: false,
                statusCode: error instanceof Error && error.name === "AbortError" ? 408 : 500,
                response: null,
            };
        }
    })();

    return Promise.race([fetchPromise, timeoutPromise]);
};
