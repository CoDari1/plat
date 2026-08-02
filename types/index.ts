// types/index.ts
export interface PlatImage {
    id: number;
    name: string;
    src: string;
    natW: number;
    natH: number;

    x: number;
    y: number;
    rot: number;
    scale: number;

    placed?: boolean;
    groupId?: number | null;
}

export interface Point {
    x: number;
    y: number;
}


export interface ControlPoint {
    id: number;
    aId: number;
    ax: number;
    ay: number;
    bId: number;
    bx: number;
    by: number;
    auto?: boolean;
}

export interface PendingPoint {
    imgId: number;
    x: number;
    y: number;
}

export type EditorMode = "move" | "point";
