import createIconSet from '@expo/vector-icons/createIconSet';
import glyphMap from '../../assets/icons/MaterialCommunityIcons.json';

const MaterialCommunityIcons = createIconSet(
  glyphMap as Record<string, number>,
  'MaterialCommunityIcons',
  require('../../assets/fonts/MaterialCommunityIcons.ttf')
);

export default MaterialCommunityIcons;