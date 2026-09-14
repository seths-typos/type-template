/**
 * The allowed values for every choice field, defined once. The resolver
 * validates against these and the field report and form render them, so an
 * option cannot exist in one place and not the other.
 */
export const ORIENTATIONS = ['portrait', 'landscape'] as const;

export const METRIC_MODES = ['capHeight', 'rowCount'] as const;

export const VERTICAL_ALIGNMENTS = ['top', 'center', 'justify'] as const;
