import { motion } from 'framer-motion';
import { PLAY_COLORS } from '@uno/shared';
import type { PlayColor } from '@uno/shared';

interface ColorPickerProps {
  onPick: (color: PlayColor) => void;
  onCancel: () => void;
}

export const ColorPicker = ({ onPick, onCancel }: ColorPickerProps) => (
  <motion.div className="color-picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.div
      className="color-picker"
      initial={{ scale: 0.85, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.85, y: 20 }}
    >
      <div className="panel-title">Choose color</div>
      <div className="color-grid">
        {PLAY_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`color-swatch swatch-${color}`}
            aria-label={color}
            onClick={() => onPick(color)}
          />
        ))}
      </div>
      <button type="button" className="ghost-button" onClick={onCancel}>
        Cancel
      </button>
    </motion.div>
  </motion.div>
);
