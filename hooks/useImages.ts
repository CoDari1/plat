import { PlatImage } from "@/types";
import { arrangePlatGrid } from "@/lib/layout";

export function useImageLoader(
    setImages: React.Dispatch<React.SetStateAction<PlatImage[]>>
) {
    return async function loadFiles(files: FileList) {
        const loaded = await Promise.all(Array.from(files).map((file, index) =>
            new Promise<PlatImage>((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const image = new Image();

                image.onload = () => {
                    resolve({
                            id: Date.now() + index,
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
        })));

        setImages((current) => arrangePlatGrid([...current, ...loaded]));
    };
}
