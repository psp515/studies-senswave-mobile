import { timestampDate, type Timestamp } from "@bufbuild/protobuf/wkt";
import type { DisplayDeviceDto, GetDeviceResponse } from "@/api/gen/devices/v1/devices_pb";
import type { GetOperationResponse } from "@/api/gen/devices/v1/operations_pb";
import type { DisplayWidgetsResponse, GetWidgetResponse } from "@/api/gen/devices/v1/widgets_pb";
import { fromProtoValue, structToJson } from "@/api/json";

export type OperationType = "Boolean" | "Number" | "Integer" | "Text" | "HexColor" | "Options";

export type DevicePresenceType = "" | "Default" | "BooleanOperation";

export type WidgetType =
    | "Invalid"
    | "Empty"
    | "Button"
    | "Display"
    | "Switch"
    | "Radio"
    | "Slider"
    | "Color"
    | "TimeSeriesGraph"
    | "";

export type WidgetListDto = {
    id: string;
    name: string;
    type: WidgetType;
    enabled: boolean;

    // Frontend only field
    empty?: boolean;
};

export type OperationGroupListDto = {
    id: string;
    name: string;
    type: OperationType;
};

export type OperationGroup = {
    widgets: WidgetListDto[];
    operation: OperationGroupListDto;
};

export type OperationDto = {
    id: string;
    name: string;
    topic: string;
    type: OperationType;
    configuration: any;
};

export type WidgetDto = {
    id: string;
    deviceId: string;
    operationId: string;

    name: string;
    type: WidgetType;
    enabled: boolean;

    configuration: any;
};

export interface OperationListDto {
    id: string;
    name: string;
    type: OperationType;
}

export interface DeviceTile {
    type: string;
    operationId?: string;
    displayableOperationId?: string;
    value: unknown;
    configuration?: Record<string, unknown>;
}

export interface DevicePresence {
    type: DevicePresenceType;
    operationId?: string;
    value?: boolean | null;
    lastSeenAtUtc?: string | null;
}

export interface Device {
    id: string;
    roomId?: string;
    icon: string;
    name: string;
    tile: DeviceTile;
    presence?: DevicePresence;
    createdAtUtc: string;
    updatedAtUtc: string;
}

export type ListDashboardDto = {
    id: string;
    name: string;
    icon: string;
    type: string;
};

export type DashboardDisplayDto = {
    type: string;
    configuration: Record<string, unknown>;
};

const isoOrEmpty = (t: Timestamp | undefined): string => (t ? timestampDate(t).toISOString() : "");

export const toDevice = (dto: DisplayDeviceDto): Device => ({
    id: dto.id,
    roomId: dto.roomId,
    icon: dto.icon,
    name: dto.name,
    tile: {
        type: dto.tile?.type ?? "",
        value: fromProtoValue(dto.tile?.value),
        configuration: structToJson(dto.tile?.configuration),
    },
    presence: dto.presence
        ? {
              type: dto.presence.type as DevicePresenceType,
              value: dto.presence.value ?? null,
              lastSeenAtUtc: dto.presence.lastSeenAtUtc
                  ? timestampDate(dto.presence.lastSeenAtUtc).toISOString()
                  : null,
          }
        : undefined,
    createdAtUtc: isoOrEmpty(dto.createdAtUtc),
    updatedAtUtc: isoOrEmpty(dto.updatedAtUtc),
});

export const toDeviceDetails = (r: GetDeviceResponse): Device => ({
    id: r.id,
    roomId: r.roomId,
    icon: r.icon,
    name: r.name,
    tile: {
        type: r.tile?.type ?? "",
        operationId: r.tile?.operationId,
        displayableOperationId: r.tile?.displayableOperationId,
        value: null,
        configuration: structToJson(r.tile?.configuration),
    },
    presence: r.presence
        ? { type: r.presence.type as DevicePresenceType, operationId: r.presence.operationId }
        : undefined,
    createdAtUtc: "",
    updatedAtUtc: "",
});

export const toOperationDto = (r: GetOperationResponse): OperationDto => ({
    id: r.id,
    name: r.name,
    topic: r.topic,
    type: r.type as OperationType,
    configuration: structToJson(r.configuration),
});

export const toWidgetDto = (r: GetWidgetResponse): WidgetDto => ({
    id: r.id,
    deviceId: r.deviceId,
    operationId: r.operationId,
    name: r.name,
    type: r.type as WidgetType,
    enabled: r.enabled,
    configuration: structToJson(r.configuration),
});

export const toOperationGroups = (r: DisplayWidgetsResponse): OperationGroup[] =>
    r.items.map((g) => ({
        operation: {
            id: g.operation?.id ?? "",
            name: g.operation?.name ?? "",
            type: (g.operation?.type ?? "") as OperationType,
        },
        widgets: g.widgets.map((w) => ({
            id: w.id,
            name: w.name,
            type: w.type as WidgetType,
            enabled: w.enabled,
        })),
    }));
