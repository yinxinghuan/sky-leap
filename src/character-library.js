import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const PEOPLE = [
  ['commuter', '赶班族', 'COMMUTER'], ['shopkeeper', '店员', 'SHOPKEEPER'], ['granny', '奶奶', 'GRANNY'], ['oldman', '老先生', 'OLD MAN'], ['blonde', '金发女士', 'BLONDE'], ['kid', '小学生', 'KID'], ['businessman', '商务主管', 'BUSINESSMAN'], ['officeWoman', '办公室职员', 'OFFICE WOMAN'], ['student', '学生', 'STUDENT'], ['darkWoman', '都市女士', 'CITY WOMAN'], ['worker', '工人', 'WORKER'], ['teen', '少年', 'TEEN'], ['fitWoman', '健身达人', 'FIT WOMAN'], ['chef', '厨师', 'CHEF'], ['bigGuy', '壮汉', 'BIG GUY'],
  ['cop', '警察', 'COP'], ['nurse', '护士', 'NURSE'], ['firefighter', '消防员', 'FIREFIGHTER'], ['construction', '建筑工', 'CONSTRUCTION'], ['delivery', '报童', 'NEWSIE'], ['cowboy', '牛仔', 'COWBOY'], ['punk', '朋克', 'PUNK'], ['rapper', '说唱歌手', 'RAPPER'], ['biker', '机车客', 'BIKER'], ['goth', '哥特女士', 'GOTH'], ['executive', '高管', 'EXECUTIVE'], ['courier', '快递员', 'COURIER'], ['janitor', '清洁工', 'JANITOR'], ['barista', '咖啡师', 'BARISTA'], ['securityGuard', '保安', 'SECURITY'], ['swat', '特警', 'SWAT'], ['viking', '维京战士', 'VIKING'], ['combatMech', '战斗机器人', 'COMBAT MECH'], ['minotaur', '牛头战士', 'MINOTAUR'], ['paramedic', '急救员', 'PARAMEDIC'],
];
const MONSTERS = [['vampire', '吸血鬼', 'VAMPIRE'], ['werewolf', '狼人', 'WEREWOLF'], ['zombie', '僵尸', 'ZOMBIE'], ['ghost', '幽灵', 'GHOST'], ['skeleton', '骷髅', 'SKELETON'], ['mummy', '木乃伊', 'MUMMY']];
const ANIMALS = [['pig', '小猪', 'PIG'], ['cow', '奶牛', 'COW'], ['cat', '地铁猫', 'METRO CAT'], ['fox', '狐狸', 'FOX'], ['chicken', '小鸡', 'CHICKEN'], ['frog', '青蛙', 'FROG'], ['dog', '通勤犬', 'COMMUTER DOG'], ['sheep', '绵羊', 'SHEEP'], ['rabbit', '兔子', 'RABBIT'], ['bear', '棕熊', 'BEAR'], ['duck', '鸭子', 'DUCK']];

function entries(items, category, offset){
  const tone = category === '动物' ? '#83b986' : category === '怪物' ? '#a68acc' : '#7ba9dc';
  return items.map(([key, name, en], index) => ({ key, name, en, category, tone, tier: category === '动物' ? '动物' : category === '怪物' ? '异界' : index > 29 ? '特殊' : '通勤者', cost: offset + index * 8 }));
}

export const CHARACTER_CATALOG = [
  { key: 'commuter', name: '赶班族', en: 'COMMUTER', category: '人物', tone: '#7ba9dc', tier: '起始', cost: 0 },
  ...entries(PEOPLE.slice(1), '人物', 16),
  ...entries(MONSTERS, '怪物', 260),
  ...entries(ANIMALS, '动物', 316),
];

export const CHARACTER_KEYS = new Set(CHARACTER_CATALOG.map(character => character.key));
export const ANIMAL_KEYS = new Set(ANIMALS.map(([key]) => key));

const files = import.meta.glob('./assets/characters/*.glb', { eager: true, query: '?url', import: 'default' });
const urls = new Map(Object.entries(files).map(([file, url]) => [file.split('/').pop().replace(/\.glb$/, '').split('__')[1], url]));
const models = new Map();
let preloadPromise = null;

export async function preloadCharacterLibrary(){
  if (preloadPromise) return preloadPromise;
  preloadPromise = (async () => {
    const loader = new GLTFLoader();
    await Promise.all([...urls].map(async ([id, url]) => {
      let lastError;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const gltf = await loader.loadAsync(url);
          models.set(id, gltf.scene);
          return;
        } catch (error) {
          lastError = error;
          await new Promise(resolve => setTimeout(resolve, 120 * (attempt + 1)));
        }
      }
      throw lastError;
    }));
    if (models.size !== 52) throw new Error(`Expected 52 character assets, loaded ${models.size}`);
  })();
  return preloadPromise;
}

export function cloneCharacterAsset(id){
  const source = models.get(id);
  if (!source) return null;
  const clone = source.clone(true);
  clone.traverse(object => {
    if (!object.isMesh) return;
    object.geometry = object.geometry.clone();
    object.material = Array.isArray(object.material) ? object.material.map(material => material.clone()) : object.material.clone();
    object.castShadow = true; object.receiveShadow = true;
  });
  return clone;
}

export function characterAssetCount(){ return models.size; }
