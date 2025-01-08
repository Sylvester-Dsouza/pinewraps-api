-- Add SEO fields to Product table
ALTER TABLE "Product"
ADD COLUMN "metaTitle" VARCHAR(60),
ADD COLUMN "metaDescription" VARCHAR(160),
ADD COLUMN "metaKeywords" TEXT,
ADD COLUMN "ogTitle" VARCHAR(95),
ADD COLUMN "ogDescription" VARCHAR(200),
ADD COLUMN "ogImage" TEXT,
ADD COLUMN "twitterTitle" VARCHAR(95),
ADD COLUMN "twitterDescription" VARCHAR(200),
ADD COLUMN "twitterImage" TEXT,
ADD COLUMN "canonicalUrl" TEXT,
ADD COLUMN "structuredData" JSONB,
ADD COLUMN "robotsDirectives" TEXT DEFAULT 'index, follow';
