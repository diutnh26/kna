BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] NVARCHAR(1000) NOT NULL,
    [email] NVARCHAR(1000) NOT NULL,
    [passwordHash] NVARCHAR(1000) NOT NULL,
    [fullName] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL CONSTRAINT [User_role_df] DEFAULT 'GUEST',
    [locale] NVARCHAR(1000) NOT NULL CONSTRAINT [User_locale_df] DEFAULT 'en',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Provider] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [displayName] NVARCHAR(1000) NOT NULL,
    [buon] NVARCHAR(1000) NOT NULL,
    [bio] NVARCHAR(max),
    [verified] BIT NOT NULL CONSTRAINT [Provider_verified_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Provider_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Provider_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Provider_userId_key] UNIQUE NONCLUSTERED ([userId])
);

-- CreateTable
CREATE TABLE [dbo].[Listing] (
    [id] NVARCHAR(1000) NOT NULL,
    [providerId] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [blurb] NVARCHAR(max) NOT NULL,
    [priceVnd] INT NOT NULL,
    [unit] NVARCHAR(1000) NOT NULL,
    [duration] NVARCHAR(1000) NOT NULL,
    [groupSize] NVARCHAR(1000) NOT NULL,
    [carbonRating] NVARCHAR(1000) NOT NULL,
    [customs] NVARCHAR(max),
    [published] BIT NOT NULL CONSTRAINT [Listing_published_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Listing_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Listing_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[AvailabilitySlot] (
    [id] NVARCHAR(1000) NOT NULL,
    [listingId] NVARCHAR(1000) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [capacity] INT NOT NULL,
    [booked] INT NOT NULL CONSTRAINT [AvailabilitySlot_booked_df] DEFAULT 0,
    CONSTRAINT [AvailabilitySlot_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AvailabilitySlot_listingId_date_key] UNIQUE NONCLUSTERED ([listingId],[date])
);

-- CreateTable
CREATE TABLE [dbo].[Booking] (
    [id] NVARCHAR(1000) NOT NULL,
    [listingId] NVARCHAR(1000) NOT NULL,
    [guestId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Booking_status_df] DEFAULT 'PENDING',
    [guests] INT NOT NULL,
    [totalVnd] INT NOT NULL,
    [platformFeeVnd] INT NOT NULL,
    [communityFundVnd] INT NOT NULL,
    [providerPayoutVnd] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Booking_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Booking_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Product] (
    [id] NVARCHAR(1000) NOT NULL,
    [providerId] NVARCHAR(1000) NOT NULL,
    [category] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [note] NVARCHAR(max) NOT NULL,
    [priceVnd] INT NOT NULL,
    [stock] INT NOT NULL,
    [published] BIT NOT NULL CONSTRAINT [Product_published_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Product_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Product_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Order] (
    [id] NVARCHAR(1000) NOT NULL,
    [buyerId] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL CONSTRAINT [Order_status_df] DEFAULT 'PENDING',
    [totalVnd] INT NOT NULL,
    [marketplaceFeeVnd] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Order_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Order_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[OrderItem] (
    [id] NVARCHAR(1000) NOT NULL,
    [orderId] NVARCHAR(1000) NOT NULL,
    [productId] NVARCHAR(1000) NOT NULL,
    [quantity] INT NOT NULL,
    [unitPriceVnd] INT NOT NULL,
    CONSTRAINT [OrderItem_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[LedgerEntry] (
    [id] NVARCHAR(1000) NOT NULL,
    [bookingId] NVARCHAR(1000),
    [orderId] NVARCHAR(1000),
    [fromLabel] NVARCHAR(1000) NOT NULL,
    [toLabel] NVARCHAR(1000) NOT NULL,
    [totalVnd] INT NOT NULL,
    [platformFeeVnd] INT NOT NULL,
    [communityFundVnd] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [LedgerEntry_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [LedgerEntry_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [LedgerEntry_bookingId_key] UNIQUE NONCLUSTERED ([bookingId]),
    CONSTRAINT [LedgerEntry_orderId_key] UNIQUE NONCLUSTERED ([orderId])
);

-- CreateTable
CREATE TABLE [dbo].[CommunityFundEntry] (
    [id] NVARCHAR(1000) NOT NULL,
    [quarter] NVARCHAR(1000) NOT NULL,
    [what] NVARCHAR(1000) NOT NULL,
    [toBuon] NVARCHAR(1000) NOT NULL,
    [amountVnd] INT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CommunityFundEntry_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CommunityFundEntry_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[CommitteeMember] (
    [id] NVARCHAR(1000) NOT NULL,
    [userId] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL,
    [buon] NVARCHAR(1000) NOT NULL,
    [since] NVARCHAR(1000) NOT NULL,
    [sortOrder] INT NOT NULL CONSTRAINT [CommitteeMember_sortOrder_df] DEFAULT 0,
    CONSTRAINT [CommitteeMember_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CommitteeMember_userId_key] UNIQUE NONCLUSTERED ([userId])
);

-- CreateTable
CREATE TABLE [dbo].[CommitteeDecision] (
    [id] NVARCHAR(1000) NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [fromLabel] NVARCHAR(1000) NOT NULL,
    [date] DATETIME2 NOT NULL,
    [note] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CommitteeDecision_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CommitteeDecision_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[ArchiveEntry] (
    [id] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(1000) NOT NULL,
    [title] NVARCHAR(1000) NOT NULL,
    [meta] NVARCHAR(1000) NOT NULL,
    [keeperBuon] NVARCHAR(1000) NOT NULL,
    [body] NVARCHAR(max),
    [pillar] NVARCHAR(1000),
    [moderationStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [ArchiveEntry_moderationStatus_df] DEFAULT 'IN_REVIEW',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ArchiveEntry_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [contributedById] NVARCHAR(1000),
    [moderatedById] NVARCHAR(1000),
    [moderatedAt] DATETIME2,
    [moderationNote] NVARCHAR(max),
    CONSTRAINT [ArchiveEntry_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Phrase] (
    [id] NVARCHAR(1000) NOT NULL,
    [ede] NVARCHAR(1000) NOT NULL,
    [en] NVARCHAR(1000) NOT NULL,
    [note] NVARCHAR(max) NOT NULL,
    [sortOrder] INT NOT NULL CONSTRAINT [Phrase_sortOrder_df] DEFAULT 0,
    [moderationStatus] NVARCHAR(1000) NOT NULL CONSTRAINT [Phrase_moderationStatus_df] DEFAULT 'IN_REVIEW',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Phrase_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Phrase_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[Provider] ADD CONSTRAINT [Provider_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Listing] ADD CONSTRAINT [Listing_providerId_fkey] FOREIGN KEY ([providerId]) REFERENCES [dbo].[Provider]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[AvailabilitySlot] ADD CONSTRAINT [AvailabilitySlot_listingId_fkey] FOREIGN KEY ([listingId]) REFERENCES [dbo].[Listing]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Booking] ADD CONSTRAINT [Booking_listingId_fkey] FOREIGN KEY ([listingId]) REFERENCES [dbo].[Listing]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Booking] ADD CONSTRAINT [Booking_guestId_fkey] FOREIGN KEY ([guestId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Product] ADD CONSTRAINT [Product_providerId_fkey] FOREIGN KEY ([providerId]) REFERENCES [dbo].[Provider]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Order] ADD CONSTRAINT [Order_buyerId_fkey] FOREIGN KEY ([buyerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[OrderItem] ADD CONSTRAINT [OrderItem_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrderItem] ADD CONSTRAINT [OrderItem_productId_fkey] FOREIGN KEY ([productId]) REFERENCES [dbo].[Product]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[LedgerEntry] ADD CONSTRAINT [LedgerEntry_bookingId_fkey] FOREIGN KEY ([bookingId]) REFERENCES [dbo].[Booking]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[LedgerEntry] ADD CONSTRAINT [LedgerEntry_orderId_fkey] FOREIGN KEY ([orderId]) REFERENCES [dbo].[Order]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CommitteeMember] ADD CONSTRAINT [CommitteeMember_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[ArchiveEntry] ADD CONSTRAINT [ArchiveEntry_contributedById_fkey] FOREIGN KEY ([contributedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ArchiveEntry] ADD CONSTRAINT [ArchiveEntry_moderatedById_fkey] FOREIGN KEY ([moderatedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
