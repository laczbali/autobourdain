import type { Suggestion } from '@autobourdain/shared';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Body, Caption, Eyebrow, Heading, Stepper } from '@/components/ui';

import { formatDuration } from './duration';
import { formatIngredientAmount } from './scale';

type Props = {
  suggestion: Suggestion;
  portions: number;
  onPortionsChange: (portions: number) => void;
  /** Method under the ingredients, rather than beside them. */
  stacked: boolean;
};

/**
 * The chosen suggestion's recipe: ingredients for however many portions are
 * set, and the method beside them.
 *
 * Laid out like `2e`'s two columns, but not split the way `2e` splits them -
 * it has what comes out of the kitchen against what needs buying, and there is
 * no kitchen to check against yet. The portions control moved here from the
 * ask column, since portions are a property of the recipe once it is chosen.
 */
export function WhatItTakes({ suggestion, portions, onPortionsChange, stacked }: Props) {
  return (
    <View className="gap-4">
      <View className="flex-row flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {/* The time sits with the title, as on the card, and well clear of the
            portions control. */}
        <View className="flex-shrink flex-row items-baseline gap-3">
          <Heading level={2} className="flex-shrink">
            {suggestion.title}
          </Heading>
          <Caption tone="secondary">{formatDuration(suggestion.totalMinutes)}</Caption>
        </View>
        <View className="flex-row items-center gap-2">
          <Caption tone="secondary">Portions</Caption>
          <Stepper value={portions} onChange={onPortionsChange} label="portions" />
        </View>
      </View>

      {/* Side by side, split by a hairline as `2e` splits its cards, so the
          amounts at the end of each ingredient row do not run into the
          method. Stacked, the gap alone separates them. */}
      <View className={stacked ? 'gap-7' : 'flex-row gap-[22px]'}>
        <Column title="Ingredients" className={stacked ? '' : 'flex-1'}>
          {suggestion.ingredients.map((ingredient, index) => (
            <Row
              key={`${ingredient.name}-${index}`}
              last={index === suggestion.ingredients.length - 1}
            >
              <Body className="flex-shrink">{ingredient.name}</Body>
              <Body tone="secondary">
                {formatIngredientAmount(ingredient, suggestion.portions, portions)}
              </Body>
            </Row>
          ))}
        </Column>

        {/* Unnumbered: the rules between steps carry the order. */}
        <Column
          title="Method"
          className={stacked ? '' : 'flex-1 border-l border-hairline pl-[22px]'}
        >
          {suggestion.method.map((step, index) => (
            <Row key={index} last={index === suggestion.method.length - 1}>
              <Body className="flex-1">{step}</Body>
            </Row>
          ))}
        </Column>
      </View>
    </View>
  );
}

function Column({
  title,
  className = '',
  children,
}: {
  title: string;
  /** Side by side each column is `flex-1`. Stacked, neither is, or they shrink into each other. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <View className={`gap-[11px] ${className}`}>
      <Eyebrow>{title}</Eyebrow>
      {children}
    </View>
  );
}

/** A list row, with the light rule under every one but the last. */
function Row({ last, children }: { last: boolean; children: ReactNode }) {
  return (
    <View className={`flex-row justify-between gap-4 ${last ? '' : 'border-b border-rule pb-2'}`}>
      {children}
    </View>
  );
}
