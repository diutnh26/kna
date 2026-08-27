-- Two constraints the application layer was carrying alone.

-- 1. Stock can never go negative.
--
-- The order route now claims stock with a conditional UPDATE, which is what
-- actually prevents overselling. This is the backstop: if that logic is ever
-- refactored back into a read-then-write, the database refuses instead of
-- silently selling a one-of-a-kind object five times over.
ALTER TABLE "Product"
  ADD CONSTRAINT "CK_Product_stock_non_negative" CHECK ("stock" >= 0);

-- 2. Product.category was free text while Listing.category had a CHECK.
--
-- Marketplace filters are built on this column, so a typo created a category
-- nobody could browse and no error anywhere. The permitted values are the
-- ones the marketplace filter row actually offers.
ALTER TABLE "Product"
  ADD CONSTRAINT "CK_Product_category" CHECK (
    "category" IN ('Textile', 'Basketry', 'Woodwork', 'Coffee', 'Jewellery')
  );
