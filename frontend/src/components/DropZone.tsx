import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { uploadFile } from '../api';

/** Drop Camel YAML files anywhere on the window to add them to the diagram (kept in memory on the server). */
export function DropZone({ onError, onUploaded }: { onError: (msg: string) => void; onUploaded: (paths: string[]) => void }) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current++;
      setActive(true);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (depth.current === 0) setActive(false);
    };
    const drop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setActive(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      const yaml = files.filter((f) => /\.ya?ml$/i.test(f.name));
      if (yaml.length === 0) {
        onError('Only .yaml / .yml files can be added.');
        return;
      }
      const added: string[] = [];
      for (const f of yaml) {
        try {
          await uploadFile(f);
          added.push(`uploaded/${f.name.replace(/[\\/]/g, '_')}`);
        } catch (err) {
          onError(`${f.name}: ${String(err)}`);
        }
      }
      if (added.length > 0) onUploaded(added);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [onError, onUploaded]);

  if (!active) return null;
  return (
    <div className="dropzone">
      <div className="dropzone-inner">
        <Upload size={28} />
        <div>Drop Camel YAML files to add them</div>
      </div>
    </div>
  );
}
