import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="modal" onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <motion.div className="modal-content" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      <header><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog" title="Close"><X size={20}/></button></header>
      {children}
    </motion.div>
  </dialog>;
};
