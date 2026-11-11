import chakkiAttaImg from './images/product_chakki_atta_1794422132339.jpg';
import basmatiRiceImg from './images/product_basmati_rice_1794422132213.jpg';
import cookingOilImg from './images/product_cooking_oil_1794422133205.jpg';
import banaspatiGheeImg from './images/product_banaspati_ghee_1794422133255.jpg';
import danedarTeaImg from './images/product_danedar_tea_1794422133814.jpg';
import uhtMilkImg from './images/product_uht_milk_1794422133867.jpg';
import biryaniMasalaImg from './images/product_biryani_masala_1794422134883.jpg';
import redSyrupImg from './images/product_red_syrup_1794422135566.jpg';
import whiteSugarImg from './images/product_white_sugar_1794422135282.jpg';
import daalChanaImg from './images/product_daal_chana_1794422135436.jpg';
import washingPowderImg from './images/product_washing_powder_1794422136846.jpg';
import bathSoapImg from './images/product_bath_soap_1794422136124.jpg';
import shopLogoImg from './images/shop_logo_emblem_1794422136435.jpg';

export const PRODUCT_IMAGE_MAP: Record<string, string> = {
  chakki_atta: chakkiAttaImg,
  basmati_rice: basmatiRiceImg,
  cooking_oil: cookingOilImg,
  banaspati_ghee: banaspatiGheeImg,
  danedar_tea: danedarTeaImg,
  uht_milk: uhtMilkImg,
  biryani_masala: biryaniMasalaImg,
  red_syrup: redSyrupImg,
  white_sugar: whiteSugarImg,
  daal_chana: daalChanaImg,
  washing_powder: washingPowderImg,
  bath_soap: bathSoapImg,
  shop_logo: shopLogoImg,
};

export const IMAGE_PRESET_OPTIONS = [
  { key: 'chakki_atta', label: 'Chakki Atta 10kg' },
  { key: 'basmati_rice', label: 'Basmati Rice 5kg' },
  { key: 'cooking_oil', label: 'Cooking Oil 5L' },
  { key: 'banaspati_ghee', label: 'Banaspati Ghee 1kg' },
  { key: 'danedar_tea', label: 'Danedar Tea 450g' },
  { key: 'uht_milk', label: 'UHT Milk 1L' },
  { key: 'biryani_masala', label: 'Masala Spice Box' },
  { key: 'red_syrup', label: 'Herbal Sharbat 800ml' },
  { key: 'white_sugar', label: 'Refined Sugar 1kg' },
  { key: 'daal_chana', label: 'Daal / Lentils 1kg' },
  { key: 'washing_powder', label: 'Washing Powder 1kg' },
  { key: 'bath_soap', label: 'Bath Soap 3-Pack' },
];

export function resolveProductImage(imageKey?: string): string {
  if (!imageKey) return chakkiAttaImg;
  if (imageKey.startsWith('data:') || imageKey.startsWith('http') || imageKey.startsWith('/')) {
    return imageKey;
  }
  return PRODUCT_IMAGE_MAP[imageKey] ?? chakkiAttaImg;
}

export function resolveShopLogo(logoKey?: string): string {
  if (!logoKey) return shopLogoImg;
  if (logoKey.startsWith('data:') || logoKey.startsWith('http') || logoKey.startsWith('/')) {
    return logoKey;
  }
  return PRODUCT_IMAGE_MAP[logoKey] ?? shopLogoImg;
}
