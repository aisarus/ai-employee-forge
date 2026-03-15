import { useState, useRef, useCallback } from "react";
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Camera, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useI18n } from "@/hooks/useI18n";

interface AvatarUploadProps {
  avatarUrl: string;
  name: string;
  onUpload: (file: File) => void;
  onRemove: () => void;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "🤖";
}

function centerAspectCrop(mediaWidth: number, mediaHeight: number) {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 80 }, 1, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

export function AvatarUpload({ avatarUrl, name, onUpload, onRemove }: AvatarUploadProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [rawImage, setRawImage] = useState<string>("");
  const [crop, setCrop] = useState<Crop>();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRawImage(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height));
  }, []);

  const handleCropConfirm = async () => {
    if (!imgRef.current || !crop) return;
    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(
      image,
      (crop.x * scaleX) || 0,
      (crop.y * scaleY) || 0,
      (crop.width * scaleX) || size,
      (crop.height * scaleY) || size,
      0, 0, size, size
    );
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "avatar.png", { type: "image/png" });
        onUpload(file);
      }
      setCropDialogOpen(false);
      setRawImage("");
    }, "image/png");
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative group">
        <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-border bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            getInitials(name)
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute inset-0 rounded-full bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        >
          <Camera className="h-6 w-6 text-foreground" />
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} className="text-xs">
        {avatarUrl ? t("avatar.change") : t("avatar.upload")}
      </Button>

      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("avatar.crop_title")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            {rawImage && (
              <ReactCrop crop={crop} onChange={setCrop} aspect={1} circularCrop>
                <img ref={imgRef} src={rawImage} onLoad={onImageLoad} className="max-h-[400px]" alt="Crop" />
              </ReactCrop>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCropDialogOpen(false)}>{t("avatar.cancel")}</Button>
              <Button onClick={handleCropConfirm} className="gap-2">
                <Check className="h-4 w-4" /> {t("avatar.apply")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
