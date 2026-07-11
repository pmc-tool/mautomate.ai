/* ------------------------------------------------------------------ */
/* Aurora theme — block map                                             */
/*                                                                     */
/* Theme #2's modern-minimalist renderers. Each consumes the SAME CMS   */
/* block data contract as the Learts theme, so identical published      */
/* content renders in either design.                                    */
/* ------------------------------------------------------------------ */

import type { ThemeBlockMap } from "../contract"

import HeroSlider from "./blocks/HeroSlider"
import PromoBannerGrid from "./blocks/PromoBannerGrid"
import ProductTabs from "./blocks/ProductTabs"
import DealOfDay from "./blocks/DealOfDay"
import CategoryShowcase from "./blocks/CategoryShowcase"
import BrandStrip from "./blocks/BrandStrip"
import RichText from "./blocks/RichText"
import ImageWithText from "./blocks/ImageWithText"
import Newsletter from "./blocks/Newsletter"
import InstagramGrid from "./blocks/InstagramGrid"
import Testimonials from "./blocks/Testimonials"
import Container from "@modules/cms/blocks/Container"
import ImageGallery from "@modules/cms/blocks/ImageGallery"

export const auroraBlocks: ThemeBlockMap = {
  hero_slider: HeroSlider,
  promo_banner_grid: PromoBannerGrid,
  product_tabs: ProductTabs,
  deal_of_day: DealOfDay,
  category_showcase: CategoryShowcase,
  brand_strip: BrandStrip,
  rich_text: RichText,
  image_with_text: ImageWithText,
  newsletter: Newsletter,
  instagram_grid: InstagramGrid,
  testimonials: Testimonials,
  // Composer W1: the container renderer is theme-neutral (inline flex layout +
  // atomic widgets), so both themes share the ONE component.
  image_gallery: ImageGallery,
  container: Container,
}
