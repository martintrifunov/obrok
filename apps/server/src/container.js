import { AuthRepository } from "./modules/auth/auth.repository.js";
import { ImageRepository } from "./modules/image/image.repository.js";
import { ChainRepository } from "./modules/chain/chain.repository.js";
import { ProductRepository } from "./modules/product/product.repository.js";
import { MarketProductRepository } from "./modules/product/market-product.repository.js";
import { MarketRepository } from "./modules/market/market.repository.js";
import { FeatureFlagRepository } from "./modules/feature-flag/feature-flag.repository.js";

import { TokenService } from "./modules/auth/token.service.js";
import { FileService } from "./modules/image/file.service.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { ImageService } from "./modules/image/image.service.js";
import { ChainService } from "./modules/chain/chain.service.js";
import { ProductService } from "./modules/product/product.service.js";
import { MarketService } from "./modules/market/market.service.js";
import { GeocoderService } from "./modules/scraper/geocoder.service.js";
import { ScraperService } from "./modules/scraper/scraper.service.js";
import { EmbeddingService } from "./modules/search/embedding.service.js";
import { ProductEmbeddingRepository } from "./modules/search/product-embedding.repository.js";

import { FeatureFlagService } from "./modules/feature-flag/feature-flag.service.js";
import { FeatureFlagController } from "./modules/feature-flag/feature-flag.controller.js";
import { SearchService } from "./modules/search/search.service.js";
import { SearchController } from "./modules/search/search.controller.js";
import { IntentParserService } from "./modules/search/intent-parser.service.js";
import { SmartSearchService } from "./modules/search/smart-search.service.js";
import { SmartSearchController } from "./modules/search/smart-search.controller.js";
import { PublicHolidayRepository } from "./modules/public-holiday/public-holiday.repository.js";
import { PublicHolidayService } from "./modules/public-holiday/public-holiday.service.js";
import { PublicHolidayController } from "./modules/public-holiday/public-holiday.controller.js";
import { ReportJobRepository } from "./modules/report/report-job.repository.js";
import { ReportService } from "./modules/report/report.service.js";
import { ReportController } from "./modules/report/report.controller.js";
import { AnalyticsRepository } from "./modules/analytics/analytics.repository.js";
import { AnalyticsService } from "./modules/analytics/analytics.service.js";
import { AnalyticsController } from "./modules/analytics/analytics.controller.js";

import { AuthController } from "./modules/auth/auth.controller.js";
import { ImageController } from "./modules/image/image.controller.js";
import { ChainController } from "./modules/chain/chain.controller.js";
import { ProductController } from "./modules/product/product.controller.js";
import { MarketController } from "./modules/market/market.controller.js";

const authRepository = new AuthRepository();
const imageRepository = new ImageRepository();
const chainRepository = new ChainRepository();
const productRepository = new ProductRepository();
const marketProductRepository = new MarketProductRepository();
const marketRepository = new MarketRepository();
const featureFlagRepository = new FeatureFlagRepository();
const productEmbeddingRepository = new ProductEmbeddingRepository();

const tokenService = new TokenService();
const fileService = new FileService();
const authService = new AuthService(authRepository, tokenService);
const imageService = new ImageService(imageRepository, fileService);

const chainService = new ChainService(
  chainRepository,
  imageRepository,
  marketRepository,
  marketProductRepository,
);

const productService = new ProductService(
  productRepository,
  marketRepository,
  imageRepository,
  marketProductRepository,
  productEmbeddingRepository,
);

const marketService = new MarketService(
  marketRepository,
  chainRepository,
  marketProductRepository,
);

const geocoderService = new GeocoderService();
const featureFlagService = new FeatureFlagService(featureFlagRepository);
const embeddingService = new EmbeddingService();
const analyticsRepository = new AnalyticsRepository();
const analyticsService = new AnalyticsService(analyticsRepository);

const intentParserService = new IntentParserService();

const searchService = new SearchService(
  embeddingService,
  productEmbeddingRepository,
  featureFlagService,
  intentParserService,
  analyticsService,
);

const publicHolidayRepository = new PublicHolidayRepository();
const publicHolidayService = new PublicHolidayService(publicHolidayRepository);

const reportJobRepository = new ReportJobRepository();
const reportService = new ReportService(reportJobRepository, marketRepository);

const smartSearchService = new SmartSearchService(
  intentParserService,
  searchService,
  featureFlagService,
  publicHolidayService,
  analyticsService,
);

export const scraperService = new ScraperService(
  chainRepository,
  marketRepository,
  productRepository,
  marketProductRepository,
  imageRepository,
  geocoderService,
);

export const authController = new AuthController(authService, tokenService);
export const imageController = new ImageController(imageService);
export const chainController = new ChainController(chainService);
export const productController = new ProductController(productService);
export const marketController = new MarketController(marketService);
export const featureFlagController = new FeatureFlagController(featureFlagService);
export const searchController = new SearchController(searchService);
export const smartSearchController = new SmartSearchController(smartSearchService);
export const publicHolidayController = new PublicHolidayController(publicHolidayService);
export const reportController = new ReportController(reportService);
export const analyticsController = new AnalyticsController(analyticsService);
export {
  featureFlagService,
  embeddingService,
  productEmbeddingRepository,
  productRepository,
  marketProductRepository,
  analyticsService,
};
