import { MaterialIcons } from '@expo/vector-icons';
import { HabitatType } from '../types/recording';
import { t } from '../i18n';

export type IconName = keyof typeof MaterialIcons.glyphMap;

export interface HabitatOption {
  value: HabitatType;
  label: string;
  icon: IconName;
  description: string;
}

export const HABITATS: HabitatOption[] = [
  {
    value: 'urban_park',
    label: 'Urban Park',
    icon: 'park',
    description: 'City parks, gardens, and green spaces',
  },
  {
    value: 'residential',
    label: 'Residential',
    icon: 'home',
    description: 'Housing areas, suburbs, neighborhoods',
  },
  {
    value: 'commercial',
    label: 'Commercial',
    icon: 'store',
    description: 'Shopping areas, business districts',
  },
  {
    value: 'industrial',
    label: 'Industrial',
    icon: 'factory',
    description: 'Factories, warehouses, industrial zones',
  },
  {
    value: 'forest',
    label: 'Forest',
    icon: 'forest',
    description: 'Woodlands, forests, nature reserves',
  },
  {
    value: 'water_body',
    label: 'Water Body',
    icon: 'water',
    description: 'Lakes, rivers, coastlines, beaches',
  },
  {
    value: 'rural',
    label: 'Rural',
    icon: 'grass',
    description: 'Countryside, farmland, villages',
  },
  {
    value: 'transport_hub',
    label: 'Transport Hub',
    icon: 'train',
    description: 'Stations, airports, bus terminals',
  },
  {
    value: 'mixed_use',
    label: 'Mixed Use',
    icon: 'location-city',
    description: 'Combination of multiple land uses',
  },
  {
    value: 'other',
    label: 'Other',
    icon: 'place',
    description: 'Other location types',
  },
];

export function getHabitatLabel(value: HabitatType): string {
  return t(HABITATS.find((h) => h.value === value)?.label ?? value);
}

export function getHabitatIcon(value: HabitatType): IconName {
  return HABITATS.find((h) => h.value === value)?.icon ?? 'place';
}
