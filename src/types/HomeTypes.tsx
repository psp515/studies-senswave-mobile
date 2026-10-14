import type { GetHomeResponse, HomeDto } from "@/api/gen/homes/v1/homes_pb";

export type HomeSharingDto = {
    sharingId: string;
    friendEmail: string;
    sharingType: string;
};

export const HomeRolesToName: Map<string, string> = new Map([
    ["Display", "Display and Act in Home"],
    ["Manage", "Display, Act and Manage Home"],
    ["Invalid", "Invalid Role"],
    ["", "Empty Role"],
]);

export interface Room {
    id: string;
    name: string;
}

export interface Location {
    latitude: number;
    longitude: number;
}

export interface HomeDataSource {
    id?: string;
    name: string;
    state: string;
}

export interface Home {
    id: string;

    name: string;
    icon: string;
    isOwner: boolean;

    dataSource?: HomeDataSource;
    location: Location;
    rooms: Room[];
}

export type HomeListItemDto = HomeDto;

export const toHome = (r: GetHomeResponse): Home => ({
    id: r.id,
    name: r.name,
    icon: r.icon,
    isOwner: r.isOwner,
    dataSource: r.dataSource
        ? { id: r.dataSource.id, name: r.dataSource.name, state: r.dataSource.state }
        : undefined,
    location: r.location
        ? { latitude: r.location.latitude, longitude: r.location.longitude }
        : { latitude: 0, longitude: 0 },
    rooms: r.rooms.map(({ id, name }) => ({ id, name })),
});
