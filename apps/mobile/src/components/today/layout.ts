import { useWindowDimensions } from 'react-native';

/**
 * Below this window width Today stacks into one column. Side by side it needs
 * the rail (186px), the ask column (300px) and three cards of about 270px
 * each, which comes to roughly this - narrower, the titles and descriptions
 * wrap into tall, thin columns.
 */
export const STACK_BELOW = 1400;

/** Whether Today is laid out in one column rather than side by side. */
export function useStacked() {
  return useWindowDimensions().width < STACK_BELOW;
}
