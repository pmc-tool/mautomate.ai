/* ------------------------------------------------------------------ */
/* Learts theme — block map                                             */
/*                                                                     */
/* Theme #1 reuses the original Learts block renderers verbatim (they   */
/* already live in modules/cms/blocks). This file is the theme's        */
/* block_type -> component binding; no visual change vs. the pre-theme  */
/* storefront.                                                          */
/* ------------------------------------------------------------------ */

import type { ThemeBlockMap } from "../contract"

import HeroSlider from "@modules/cms/blocks/HeroSlider"
import PromoBannerGrid from "@modules/cms/blocks/PromoBannerGrid"
import ProductTabs from "@modules/cms/blocks/ProductTabs"
import DealOfDay from "@modules/cms/blocks/DealOfDay"
import CategoryShowcase from "@modules/cms/blocks/CategoryShowcase"
import BrandStrip from "@modules/cms/blocks/BrandStrip"
import RichText from "@modules/cms/blocks/RichText"
import ImageWithText from "@modules/cms/blocks/ImageWithText"
import Newsletter from "@modules/cms/blocks/Newsletter"
import InstagramGrid from "@modules/cms/blocks/InstagramGrid"
import ImageGallery from "@modules/cms/blocks/ImageGallery"
import Testimonials from "@modules/cms/blocks/Testimonials"
import Container from "@modules/cms/blocks/Container"

export const leartsBlocks: ThemeBlockMap = {
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
  image_gallery: ImageGallery,
  testimonials: Testimonials,
  // Composer W1: theme-neutral layout composition block (shared renderer).
  container: Container,
}
