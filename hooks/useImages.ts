import { PlatImage } from "@/types";
import { arrangePlatGrid } from "@/lib/layout";
import { extractPdfPages, isPdfFile } from "@/lib/pdfPages";

function loadImageFile(file: File, seed: number, index: number): Promise<PlatImage> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            const image = new Image();

            image.onload = () => {
                resolve({
                    id: seed + index,
                    name: file.name,
                    src: e.target?.result as string,
                    natW: image.width,
                    natH: image.height,
                    x: 40 + index * 24,
                    y: 40 + index * 24,
                    rot: 0,
                    scale: 1,
                });
            };
            image.onerror = () => reject(new Error(`Could not load ${file.name}`));

            image.src = e.target?.result as string;
        };

        reader.onerror = () => reject(new Error(`Could not read ${file.name}`));

        reader.readAsDataURL(file);
    });
}

async function loadPdfFile(file: File, seed: number, index: number): Promise<PlatImage[]> {
    const pages = await extractPdfPages(file);
    return pages.map((page, pageIndex) => ({
        id: seed + index * 1000 + pageIndex,
        name: page.name,
        src: page.dataUrl,
        natW: page.width,
        natH: page.height,
        x: 40 + (index + pageIndex) * 24,
        y: 40 + (index + pageIndex) * 24,
        rot: 0,
        scale: 1,
    }));
}

export function useImageLoader(
    setImages: React.Dispatch<React.SetStateAction<PlatImage[]>>
) {
    return async function loadFiles(files: FileList) {
        const seed = Date.now();
        const groups = await Promise.all(Array.from(files).map((file, index) =>
            isPdfFile(file) ? loadPdfFile(file, seed, index) : loadImageFile(file, seed, index).then((img) => [img])
        ));

        const loaded = groups.flat();

        setImages((current) => arrangePlatGrid([...current, ...loaded]));
    };
}
