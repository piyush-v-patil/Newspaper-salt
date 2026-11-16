import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';
import { setNotes } from '@/data/commands/tasks';
import type { Id } from '@/data/types';

const SAVE_DELAY_MS = 400;

/** Rich-text notes for a task. Saves shortly after typing stops, and when closed. */
export function NotesEditor({ taskId, initial }: { taskId: Id; initial: string }) {
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; html: string } | null>(null);

  const flush = () => {
    if (!pending.current) return;
    clearTimeout(pending.current.timer);
    void setNotes(taskId, pending.current.html);
    pending.current = null;
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Notes…' }),
    ],
    content: initial,
    editorProps: { attributes: { 'aria-label': 'Notes' } },
    onUpdate: ({ editor: e }) => {
      if (pending.current) clearTimeout(pending.current.timer);
      const html = e.isEmpty ? '' : e.getHTML();
      pending.current = { html, timer: setTimeout(flush, SAVE_DELAY_MS) };
    },
    onBlur: flush,
  });

  // Save anything still waiting when the task page closes.
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="notes">
      <EditorContent editor={editor} />
    </div>
  );
}
