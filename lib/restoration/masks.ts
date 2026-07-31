export type Defect = {
    type: "scratch" | "dust" | "tear" | "gap";
    x: number;
    y: number;
    width: number;
    height: number;
};


export function createMask(
    width: number,
    height: number,
    defects: Defect[]
) {
    const mask = new Uint8Array(
        width * height
    );


    for (const defect of defects) {

        for (
            let y = defect.y;
            y < defect.y + defect.height;
            y++
        ) {

            for (
                let x = defect.x;
                x < defect.x + defect.width;
                x++
            ) {

                const index =
                    y * width + x;

                mask[index] = 255;
            }
        }
    }


    return mask;
}