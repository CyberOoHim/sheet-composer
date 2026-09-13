'use client';

import React from 'react';
import { RealSheetCanvas, RealSheetCanvasProps } from './RealSheetCanvas';

export type SheetModeViewProps = RealSheetCanvasProps;

/**
 * SheetModeView is now a direct alias to RealSheetCanvas, providing
 * the unified single WYSIWYG realistic sheet score editing canvas.
 */
export const SheetModeView: React.FC<SheetModeViewProps> = (props) => {
  return <RealSheetCanvas {...props} />;
};

export default SheetModeView;
