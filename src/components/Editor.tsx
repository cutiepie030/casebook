import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Undo2 } from 'lucide-react';
export function Editor({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  const cb = useRef(onChange);
  cb.current = onChange;
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || '',
    editorProps: { attributes: { 'aria-label': label } },
    onUpdate: ({ editor }) => cb.current(editor.getHTML()),
  });
  useEffect(() => {
    if (editor && editor.getHTML() !== value && !editor.isFocused)
      editor.commands.setContent(value || '', { emitUpdate: false });
  }, [value, editor]);
  if (!editor) return null;
  return (
    <div className="editor">
      <div className="editor-tools">
        {[
          {
            Icon: Bold,
            label: '加粗',
            action: () => editor.chain().focus().toggleBold().run(),
            active: editor.isActive('bold'),
          },
          {
            Icon: Italic,
            label: '斜体',
            action: () => editor.chain().focus().toggleItalic().run(),
            active: editor.isActive('italic'),
          },
          {
            Icon: List,
            label: '无序列表',
            action: () => editor.chain().focus().toggleBulletList().run(),
            active: editor.isActive('bulletList'),
          },
          {
            Icon: ListOrdered,
            label: '有序列表',
            action: () => editor.chain().focus().toggleOrderedList().run(),
            active: editor.isActive('orderedList'),
          },
          {
            Icon: Undo2,
            label: '撤销',
            action: () => editor.chain().focus().undo().run(),
            active: false,
          },
        ].map((x) => (
          <button
            type="button"
            title={x.label}
            aria-label={x.label}
            className={x.active ? 'active' : ''}
            key={x.label}
            onClick={x.action}
          >
            <x.Icon size={15} />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
