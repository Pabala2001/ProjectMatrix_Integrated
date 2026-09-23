import { useState, useEffect } from "react";
import { QualityControlStorageHelper } from "../utils/qualityControlStorageHelper";

export function useAssetUrl(bucket: string | null | undefined, path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!bucket || !path) {
      setUrl(null);
      return;
    }

    let isMounted = true;
    let localUrl: string | null = null;

    const fetchUrl = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // We use direct download as Blob to create Object URL
        const blob = await QualityControlStorageHelper.downloadAssetBlob(bucket, path);
        if (isMounted) {
          localUrl = URL.createObjectURL(blob);
          setUrl(localUrl);
        }
      } catch (err: any) {
        console.warn(`Could not download direct blob from ${bucket}/${path}, trying signed URL fallback:`, err.message);
        try {
          const signedUrl = await QualityControlStorageHelper.getSignedUrl(bucket, path, 1800);
          if (isMounted) {
            setUrl(signedUrl);
          }
        } catch (signedErr: any) {
          console.error("Failed both blob download and signed URL retrieval:", signedErr);
          if (isMounted) {
            setError(signedErr);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchUrl();

    return () => {
      isMounted = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [bucket, path]);

  return { url, isLoading, error };
}
