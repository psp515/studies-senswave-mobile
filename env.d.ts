declare namespace NodeJS {
    interface ProcessEnv {
        EXPO_PUBLIC_ENVIRONMENT: string;
        EXPO_PUBLIC_SENSWAVE__API__URL: string;
        EXPO_PUBLIC_MINIMAL_API_VERSION: string;
        EXPO_PUBLIC_CONTACT_EMAIL: string;
        EXPO_PUBLIC_TRANSPORT_MODE?: string;
    }
}
