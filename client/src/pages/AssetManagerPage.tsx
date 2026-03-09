import { useState, useRef } from "react";
import { useAssets, useUploadAsset, useDeleteAsset } from "@/hooks/use-assets";
import { useProjects } from "@/hooks/use-projects";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Upload, Trash2, File, Image, FileText } from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  icon: Image,
  logo: Image,
  screenshot: Image,
  document: FileText,
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetManagerPage() {
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: projectData } = useProjects();
  const { data, isLoading } = useAssets({
    projectId: projectFilter !== "all" ? parseInt(projectFilter, 10) : undefined,
    category: categoryFilter !== "all" ? categoryFilter : undefined,
  });
  const uploadAsset = useUploadAsset();
  const deleteAsset = useDeleteAsset();

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      uploadAsset.mutate({
        file,
        projectId: projectFilter !== "all" ? parseInt(projectFilter, 10) : undefined,
        category: categoryFilter !== "all" ? categoryFilter : undefined,
      });
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Assets</h1>
        <div className="flex items-center gap-3">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projectData?.projects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="icon">Icon</SelectItem>
              <SelectItem value="logo">Logo</SelectItem>
              <SelectItem value="screenshot">Screenshot</SelectItem>
              <SelectItem value="document">Document</SelectItem>
            </SelectContent>
          </Select>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" />
            Upload
          </Button>
        </div>
      </div>

      {/* Upload dropzone area */}
      <div
        className="border-2 border-dashed border-gray-200 rounded-lg p-8 mb-6 text-center hover:border-gray-300 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.preventDefault();
          const files = e.dataTransfer.files;
          for (const file of Array.from(files)) {
            uploadAsset.mutate({
              file,
              projectId: projectFilter !== "all" ? parseInt(projectFilter, 10) : undefined,
            });
          }
        }}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm text-gray-400">
          Drag files here or click to upload
        </p>
      </div>

      {/* Asset Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {data?.assets.map((asset) => {
            const IconComponent =
              CATEGORY_ICONS[asset.category] || File;
            const isImage = asset.mimeType.startsWith("image/");

            return (
              <Card key={asset.id} className="group relative">
                <CardContent className="p-3">
                  <div className="aspect-square bg-gray-50 rounded-md mb-2 flex items-center justify-center overflow-hidden">
                    {isImage ? (
                      <img
                        src={`/api/assets/file/${asset.id}`}
                        alt={asset.filename}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).parentElement!.innerHTML =
                            '<div class="text-gray-300"><svg class="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>';
                        }}
                      />
                    ) : (
                      <IconComponent className="h-12 w-12 text-gray-300" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {asset.filename}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {asset.category}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {formatBytes(asset.sizeBytes)}
                    </span>
                  </div>

                  {/* Delete button */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-white rounded-full p-1 shadow-sm hover:bg-red-50 transition-all">
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete "{asset.filename}"?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove this asset.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteAsset.mutate(asset.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            );
          })}
          {data?.assets.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">
              <File className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No assets yet. Upload files to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
