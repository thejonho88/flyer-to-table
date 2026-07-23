import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme/tokens';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 18, color = colors.text }: IconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}
