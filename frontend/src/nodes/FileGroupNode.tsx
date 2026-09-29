import { memo } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { FileCode2 } from 'lucide-react';
import type { FileGroupData } from '../toFlow';

function FileGroupNodeImpl({ data }: NodeProps<Node<FileGroupData>>) {
  return (
    <div className="file-group">
      <div className="group-header">
        <FileCode2 size={14} aria-hidden />
        <span>{data.file}</span>
      </div>
    </div>
  );
}

export const FileGroupNode = memo(FileGroupNodeImpl);
