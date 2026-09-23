use anchor_lang::prelude::*;

declare_id!("2Ft67fV4Zn747zYiKneYPwUH9ZZGKFFt1rT5KUq9JK6f");

pub const PLATFORM_FEE_BPS: u16 = 700;
pub const COMMUNITY_FEE_BPS: u16 = 300;
pub const BPS_DENOMINATOR: u16 = 10_000;
pub const SCHEMA_VERSION: u8 = 1;

pub const ROLE_COORDINATOR: u8 = 1;
pub const ROLE_COMMITTEE: u8 = 2;
pub const ROLE_PROVIDER: u8 = 3;

pub const ATTESTATION_PENDING: u8 = 0;
pub const ATTESTATION_FINALIZED: u8 = 1;
pub const ATTESTATION_CANCELLED: u8 = 2;

/// AccountRecord.flags. Every registered account can book (GUEST); PROVIDER
/// accounts can also be paid for a booking.
pub const ACCOUNT_FLAG_GUEST: u8 = 1;
pub const ACCOUNT_FLAG_PROVIDER: u8 = 2;

pub const BOOKING_BOOKED: u8 = 0;
pub const BOOKING_PAID: u8 = 1;
pub const BOOKING_UNPAID: u8 = 2;
pub const BOOKING_CANCELLED: u8 = 3;

/// SPL Token program. Token CPIs are encoded by hand (TransferChecked) rather
/// than through anchor-spl, which would pull a large dependency tree into a
/// build pinned to rustc 1.84.
/// TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA (checked in the unit tests).
pub const TOKEN_PROGRAM_ID: Pubkey = Pubkey::new_from_array([
    6, 221, 246, 225, 215, 101, 161, 147, 217, 203, 225, 70, 206, 235, 121, 172, 28, 180, 133,
    237, 95, 91, 55, 145, 58, 140, 245, 133, 126, 255, 0, 169,
]);
const TOKEN_ACCOUNT_LEN: usize = 165;
const MINT_LEN: usize = 82;
const TOKEN_IX_TRANSFER_CHECKED: u8 = 12;

#[program]
pub mod kna_trust_layer {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>, committee_vault: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.version = SCHEMA_VERSION;
        config.platform_fee_bps = PLATFORM_FEE_BPS;
        config.community_fee_bps = COMMUNITY_FEE_BPS;
        config.coordinator_authority = ctx.accounts.authority.key();
        config.committee_vault = committee_vault;
        config.paused = false;
        config.bump = ctx.bumps.config;
        emit!(ConfigInitialized {
            authority: config.coordinator_authority,
            committee_vault,
            version: SCHEMA_VERSION,
        });
        Ok(())
    }

    pub fn set_paused(ctx: Context<UpdateConfig>, paused: bool) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.config.coordinator_authority,
            KnaError::Unauthorized
        );
        ctx.accounts.config.paused = paused;
        emit!(PauseUpdated {
            paused,
            authority: ctx.accounts.authority.key(),
        });
        Ok(())
    }

    pub fn set_committee_vault(ctx: Context<UpdateConfig>, committee_vault: Pubkey) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.config.coordinator_authority,
            KnaError::Unauthorized
        );
        ctx.accounts.config.committee_vault = committee_vault;
        emit!(CommitteeVaultUpdated {
            committee_vault,
            authority: ctx.accounts.authority.key(),
        });
        Ok(())
    }

    pub fn grant_role(ctx: Context<GrantRole>, role: u8) -> Result<()> {
        require!(!ctx.accounts.config.paused, KnaError::Paused);
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.config.coordinator_authority,
            KnaError::Unauthorized
        );
        require!(
            role == ROLE_COORDINATOR || role == ROLE_COMMITTEE || role == ROLE_PROVIDER,
            KnaError::InvalidRole
        );
        let grant = &mut ctx.accounts.role_grant;
        grant.wallet = ctx.accounts.wallet.key();
        grant.role = role;
        grant.revoked = false;
        grant.bump = ctx.bumps.role_grant;
        emit!(RoleGranted {
            wallet: grant.wallet,
            role,
        });
        Ok(())
    }

    pub fn revoke_role(ctx: Context<RevokeRole>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.config.coordinator_authority,
            KnaError::Unauthorized
        );
        ctx.accounts.role_grant.revoked = true;
        emit!(RoleRevoked {
            wallet: ctx.accounts.role_grant.wallet,
            role: ctx.accounts.role_grant.role,
        });
        Ok(())
    }

    pub fn submit_attestation(
        ctx: Context<SubmitAttestation>,
        ledger_id_hash: [u8; 32],
        provider_hash: [u8; 32],
        content_hash: [u8; 32],
        total_vnd: u64,
        platform_vnd: u64,
        community_vnd: u64,
        provider_vnd: u64,
        recorded_at: i64,
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, KnaError::Paused);
        require!(!ctx.accounts.role_grant.revoked, KnaError::RoleRevoked);
        require!(
            ctx.accounts.role_grant.role == ROLE_COORDINATOR,
            KnaError::Unauthorized
        );
        require_keys_eq!(
            ctx.accounts.role_grant.wallet,
            ctx.accounts.coordinator.key(),
            KnaError::Unauthorized
        );
        validate_split(
            total_vnd,
            platform_vnd,
            community_vnd,
            provider_vnd,
            ctx.accounts.config.platform_fee_bps,
            ctx.accounts.config.community_fee_bps,
        )?;
        let pending = &mut ctx.accounts.pending_attestation;
        pending.ledger_id_hash = ledger_id_hash;
        pending.provider_hash = provider_hash;
        pending.content_hash = content_hash;
        pending.total_vnd = total_vnd;
        pending.platform_vnd = platform_vnd;
        pending.community_vnd = community_vnd;
        pending.provider_vnd = provider_vnd;
        pending.recorded_at = recorded_at;
        pending.submitted_by = ctx.accounts.coordinator.key();
        pending.status = ATTESTATION_PENDING;
        pending.bump = ctx.bumps.pending_attestation;
        emit!(AttestationSubmitted {
            ledger_id_hash,
            content_hash,
            total_vnd,
            platform_vnd,
            community_vnd,
            provider_vnd,
            submitted_by: pending.submitted_by,
        });
        Ok(())
    }

    pub fn finalize_attestation(ctx: Context<FinalizeAttestation>) -> Result<()> {
        require!(!ctx.accounts.config.paused, KnaError::Paused);
        let pending = &ctx.accounts.pending_attestation;
        require!(pending.status == ATTESTATION_PENDING, KnaError::InvalidState);
        assert_committee_or_vault(
            &ctx.accounts.config,
            &ctx.accounts.authority,
            &ctx.accounts.committee_role,
        )?;
        let signer = ctx.accounts.authority.key();
        let final_acct = &mut ctx.accounts.final_attestation;
        final_acct.ledger_id_hash = pending.ledger_id_hash;
        final_acct.provider_hash = pending.provider_hash;
        final_acct.content_hash = pending.content_hash;
        final_acct.total_vnd = pending.total_vnd;
        final_acct.platform_vnd = pending.platform_vnd;
        final_acct.community_vnd = pending.community_vnd;
        final_acct.provider_vnd = pending.provider_vnd;
        final_acct.recorded_at = pending.recorded_at;
        final_acct.finalized_at = Clock::get()?.unix_timestamp;
        final_acct.finalized_by = signer;
        final_acct.bump = ctx.bumps.final_attestation;
        ctx.accounts.pending_attestation.status = ATTESTATION_FINALIZED;
        emit!(AttestationFinalized {
            ledger_id_hash: final_acct.ledger_id_hash,
            content_hash: final_acct.content_hash,
            finalized_by: signer,
            finalized_at: final_acct.finalized_at,
        });
        Ok(())
    }

    pub fn cancel_pending(ctx: Context<CancelPending>) -> Result<()> {
        require!(!ctx.accounts.role_grant.revoked, KnaError::RoleRevoked);
        require!(
            ctx.accounts.role_grant.role == ROLE_COORDINATOR,
            KnaError::Unauthorized
        );
        require_keys_eq!(
            ctx.accounts.role_grant.wallet,
            ctx.accounts.coordinator.key(),
            KnaError::Unauthorized
        );
        require!(
            ctx.accounts.pending_attestation.status == ATTESTATION_PENDING,
            KnaError::InvalidState
        );
        ctx.accounts.pending_attestation.status = ATTESTATION_CANCELLED;
        emit!(AttestationCancelled {
            ledger_id_hash: ctx.accounts.pending_attestation.ledger_id_hash,
            cancelled_by: ctx.accounts.coordinator.key(),
        });
        Ok(())
    }

    pub fn acknowledge_receipt(
        ctx: Context<AcknowledgeReceipt>,
        ledger_id_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            ctx.accounts.final_attestation.ledger_id_hash == ledger_id_hash,
            KnaError::InvalidState
        );
        let receipt = &mut ctx.accounts.guest_receipt;
        receipt.ledger_id_hash = ledger_id_hash;
        receipt.guest = ctx.accounts.guest.key();
        receipt.acknowledged_at = Clock::get()?.unix_timestamp;
        receipt.bump = ctx.bumps.guest_receipt;
        emit!(ReceiptAcknowledged {
            ledger_id_hash,
            guest: receipt.guest,
            acknowledged_at: receipt.acknowledged_at,
        });
        Ok(())
    }

    pub fn publish_archive_proof(
        ctx: Context<PublishArchiveProof>,
        archive_id_hash: [u8; 32],
        content_hash: [u8; 32],
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, KnaError::Paused);
        assert_committee_or_vault(
            &ctx.accounts.config,
            &ctx.accounts.authority,
            &ctx.accounts.committee_role,
        )?;
        let proof = &mut ctx.accounts.archive_proof;
        proof.archive_id_hash = archive_id_hash;
        proof.content_hash = content_hash;
        proof.published_at = Clock::get()?.unix_timestamp;
        proof.revoked = false;
        proof.bump = ctx.bumps.archive_proof;
        emit!(ArchiveProofPublished {
            archive_id_hash,
            content_hash,
            published_by: ctx.accounts.authority.key(),
        });
        Ok(())
    }

    /// The dKNA payment rail: which mint, how many base units make one VND,
    /// and the platform and Community Fund wallets that receive their share.
    pub fn initialize_payment_config(
        ctx: Context<InitializePaymentConfig>,
        platform_wallet: Pubkey,
        community_wallet: Pubkey,
        units_per_vnd: u64,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.config.coordinator_authority,
            KnaError::Unauthorized
        );
        require!(units_per_vnd > 0, KnaError::InvalidMint);
        let decimals = read_mint_decimals(&ctx.accounts.mint)?;
        let pc = &mut ctx.accounts.payment_config;
        pc.mint = ctx.accounts.mint.key();
        pc.decimals = decimals;
        pc.units_per_vnd = units_per_vnd;
        pc.platform_wallet = platform_wallet;
        pc.community_wallet = community_wallet;
        pc.bump = ctx.bumps.payment_config;
        emit!(PaymentConfigSet {
            mint: pc.mint,
            platform_wallet,
            community_wallet,
            units_per_vnd,
        });
        Ok(())
    }

    pub fn update_payment_wallets(
        ctx: Context<UpdatePaymentConfig>,
        platform_wallet: Pubkey,
        community_wallet: Pubkey,
    ) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.authority.key(),
            ctx.accounts.config.coordinator_authority,
            KnaError::Unauthorized
        );
        let pc = &mut ctx.accounts.payment_config;
        pc.platform_wallet = platform_wallet;
        pc.community_wallet = community_wallet;
        emit!(PaymentConfigSet {
            mint: pc.mint,
            platform_wallet,
            community_wallet,
            units_per_vnd: pc.units_per_vnd,
        });
        Ok(())
    }

    /// Binds one KNĂ account to one wallet, for good. Two records are created
    /// with `init` — by account and by wallet — so neither an account nor a
    /// wallet can ever be registered twice. The wallet signs (it proves the
    /// key exists); a coordinator-role registrar pays and vouches for the
    /// account. Only a hash of the account id goes on-chain.
    pub fn register_account(
        ctx: Context<RegisterAccount>,
        user_hash: [u8; 32],
        flags: u8,
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, KnaError::Paused);
        assert_registrar(&ctx.accounts.registrar_role, &ctx.accounts.registrar)?;
        require!(valid_flags(flags), KnaError::InvalidRole);
        let now = Clock::get()?.unix_timestamp;
        let wallet = ctx.accounts.wallet.key();

        let account = &mut ctx.accounts.account_record;
        account.user_hash = user_hash;
        account.wallet = wallet;
        account.payment_wallet = wallet;
        account.flags = flags;
        account.registered_at = now;
        account.bump = ctx.bumps.account_record;

        let by_wallet = &mut ctx.accounts.wallet_record;
        by_wallet.wallet = wallet;
        by_wallet.user_hash = user_hash;
        by_wallet.bump = ctx.bumps.wallet_record;

        emit!(AccountRegistered {
            user_hash,
            wallet,
            flags,
            registered_at: now,
        });
        Ok(())
    }

    /// E.g. a guest who becomes a homestay provider.
    pub fn set_account_flags(ctx: Context<SetAccountFlags>, flags: u8) -> Result<()> {
        assert_registrar(&ctx.accounts.registrar_role, &ctx.accounts.registrar)?;
        require!(valid_flags(flags), KnaError::InvalidRole);
        let account = &mut ctx.accounts.account_record;
        account.flags = flags;
        emit!(AccountFlagsSet {
            user_hash: account.user_hash,
            flags,
        });
        Ok(())
    }

    /// Which wallet pays this account's bookings: its own fixed wallet, or a
    /// wallet the user brings (Phantom). Both sign, so nobody can point an
    /// account at a wallet they do not control. Passing the account's own
    /// wallet as `payment_wallet` unlinks.
    pub fn set_payment_wallet(ctx: Context<SetPaymentWallet>) -> Result<()> {
        let account = &mut ctx.accounts.account_record;
        account.payment_wallet = ctx.accounts.payment_wallet.key();
        emit!(PaymentWalletSet {
            user_hash: account.user_hash,
            wallet: account.wallet,
            payment_wallet: account.payment_wallet,
        });
        Ok(())
    }

    /// Records a confirmed booking: who stays, who hosts (a registered
    /// provider, whose fixed wallet is the payee), the dates, and the split
    /// of the total — which must be the 7 / 3 / 90 schedule.
    #[allow(clippy::too_many_arguments)]
    pub fn create_booking(
        ctx: Context<CreateBooking>,
        booking_hash: [u8; 32],
        check_in: i64,
        check_out: i64,
        total_vnd: u64,
        platform_vnd: u64,
        community_vnd: u64,
        provider_vnd: u64,
    ) -> Result<()> {
        require!(!ctx.accounts.config.paused, KnaError::Paused);
        assert_registrar(&ctx.accounts.registrar_role, &ctx.accounts.registrar)?;
        require!(
            ctx.accounts.provider_account.flags & ACCOUNT_FLAG_PROVIDER != 0,
            KnaError::NotProvider
        );
        require!(check_out > check_in, KnaError::InvalidDates);
        validate_split(
            total_vnd,
            platform_vnd,
            community_vnd,
            provider_vnd,
            ctx.accounts.config.platform_fee_bps,
            ctx.accounts.config.community_fee_bps,
        )?;
        let now = Clock::get()?.unix_timestamp;
        let booking = &mut ctx.accounts.booking;
        booking.booking_hash = booking_hash;
        booking.guest_user_hash = ctx.accounts.guest_account.user_hash;
        booking.provider_user_hash = ctx.accounts.provider_account.user_hash;
        booking.provider_wallet = ctx.accounts.provider_account.wallet;
        booking.check_in = check_in;
        booking.check_out = check_out;
        booking.total_vnd = total_vnd;
        booking.platform_vnd = platform_vnd;
        booking.community_vnd = community_vnd;
        booking.provider_vnd = provider_vnd;
        booking.status = BOOKING_BOOKED;
        booking.paid_by = Pubkey::default();
        booking.paid_at = 0;
        booking.created_at = now;
        booking.bump = ctx.bumps.booking;
        emit!(BookingCreated {
            booking_hash,
            guest_user_hash: booking.guest_user_hash,
            provider_wallet: booking.provider_wallet,
            check_in,
            check_out,
            total_vnd,
        });
        Ok(())
    }

    /// Payment at check-out, from the guest's paying wallet: three CPI
    /// transfers into SPL Token for the booked split — 90% to the provider's
    /// fixed wallet, 3% to the Community Fund, 7% to the platform. Only on or
    /// after the check-out date, only once.
    pub fn pay_booking(ctx: Context<PayBooking>) -> Result<()> {
        require!(!ctx.accounts.config.paused, KnaError::Paused);
        let booking = &ctx.accounts.booking;
        require!(
            booking.status == BOOKING_BOOKED || booking.status == BOOKING_UNPAID,
            KnaError::InvalidState
        );
        require_keys_eq!(
            ctx.accounts.payer.key(),
            ctx.accounts.guest_account.payment_wallet,
            KnaError::Unauthorized
        );
        let now = Clock::get()?.unix_timestamp;
        require!(now >= booking.check_out, KnaError::NotPayableYet);

        let pc = &ctx.accounts.payment_config;
        let (payer_mint, payer_owner) = read_token_account(&ctx.accounts.payer_token)?;
        let (provider_mint, provider_owner) = read_token_account(&ctx.accounts.provider_token)?;
        let (community_mint, community_owner) = read_token_account(&ctx.accounts.community_token)?;
        let (platform_mint, platform_owner) = read_token_account(&ctx.accounts.platform_token)?;
        for mint in [payer_mint, provider_mint, community_mint, platform_mint] {
            require_keys_eq!(mint, pc.mint, KnaError::InvalidMint);
        }
        require_keys_eq!(payer_owner, ctx.accounts.payer.key(), KnaError::InvalidTokenAccount);
        require_keys_eq!(provider_owner, booking.provider_wallet, KnaError::InvalidTokenAccount);
        require_keys_eq!(community_owner, pc.community_wallet, KnaError::InvalidTokenAccount);
        require_keys_eq!(platform_owner, pc.platform_wallet, KnaError::InvalidTokenAccount);

        let units = pc.units_per_vnd;
        let to_units = |vnd: u64| vnd.checked_mul(units).ok_or(error!(KnaError::Overflow));
        let transfers = [
            (&ctx.accounts.provider_token, to_units(booking.provider_vnd)?),
            (&ctx.accounts.community_token, to_units(booking.community_vnd)?),
            (&ctx.accounts.platform_token, to_units(booking.platform_vnd)?),
        ];
        for (destination, amount) in transfers {
            if amount == 0 {
                continue;
            }
            transfer_checked(
                &ctx.accounts.token_program,
                &ctx.accounts.payer_token,
                &ctx.accounts.mint,
                destination,
                &ctx.accounts.payer.to_account_info(),
                amount,
                pc.decimals,
                &[],
            )?;
        }

        let booking = &mut ctx.accounts.booking;
        booking.status = BOOKING_PAID;
        booking.paid_by = ctx.accounts.payer.key();
        booking.paid_at = now;
        emit!(BookingPaid {
            booking_hash: booking.booking_hash,
            paid_by: booking.paid_by,
            provider_vnd: booking.provider_vnd,
            community_vnd: booking.community_vnd,
            platform_vnd: booking.platform_vnd,
            paid_at: now,
        });
        Ok(())
    }

    /// Past check-out and still unpaid: recorded as UNPAID (it stays payable).
    pub fn mark_unpaid(ctx: Context<UpdateBooking>) -> Result<()> {
        assert_registrar(&ctx.accounts.registrar_role, &ctx.accounts.registrar)?;
        let booking = &mut ctx.accounts.booking;
        require!(booking.status == BOOKING_BOOKED, KnaError::InvalidState);
        require!(Clock::get()?.unix_timestamp >= booking.check_out, KnaError::NotPayableYet);
        booking.status = BOOKING_UNPAID;
        emit!(BookingStatusChanged {
            booking_hash: booking.booking_hash,
            status: BOOKING_UNPAID,
        });
        Ok(())
    }

    /// Cancelled before check-in; nothing was paid.
    pub fn cancel_booking(ctx: Context<UpdateBooking>) -> Result<()> {
        assert_registrar(&ctx.accounts.registrar_role, &ctx.accounts.registrar)?;
        let booking = &mut ctx.accounts.booking;
        require!(booking.status == BOOKING_BOOKED, KnaError::InvalidState);
        require!(Clock::get()?.unix_timestamp < booking.check_in, KnaError::InvalidDates);
        booking.status = BOOKING_CANCELLED;
        emit!(BookingStatusChanged {
            booking_hash: booking.booking_hash,
            status: BOOKING_CANCELLED,
        });
        Ok(())
    }

    pub fn revoke_archive_proof(ctx: Context<RevokeArchiveProof>) -> Result<()> {
        assert_committee_or_vault(
            &ctx.accounts.config,
            &ctx.accounts.authority,
            &ctx.accounts.committee_role,
        )?;
        ctx.accounts.archive_proof.revoked = true;
        emit!(ArchiveProofRevoked {
            archive_id_hash: ctx.accounts.archive_proof.archive_id_hash,
            revoked_by: ctx.accounts.authority.key(),
        });
        Ok(())
    }
}

fn assert_committee_or_vault(
    config: &Account<Config>,
    authority: &Signer,
    committee_role: &Option<Account<RoleGrant>>,
) -> Result<()> {
    let signer = authority.key();
    if signer == config.committee_vault {
        return Ok(());
    }
    let role = committee_role
        .as_ref()
        .ok_or(error!(KnaError::Unauthorized))?;
    require!(!role.revoked, KnaError::RoleRevoked);
    require!(role.role == ROLE_COMMITTEE, KnaError::Unauthorized);
    require_keys_eq!(role.wallet, signer, KnaError::Unauthorized);
    Ok(())
}

/// The registrar is the platform's coordinator-role key.
fn assert_registrar(role: &Account<RoleGrant>, signer: &Signer) -> Result<()> {
    require!(!role.revoked, KnaError::RoleRevoked);
    require!(role.role == ROLE_COORDINATOR, KnaError::Unauthorized);
    require_keys_eq!(role.wallet, signer.key(), KnaError::Unauthorized);
    Ok(())
}

fn valid_flags(flags: u8) -> bool {
    flags != 0 && flags & !(ACCOUNT_FLAG_GUEST | ACCOUNT_FLAG_PROVIDER) == 0
}

fn validate_split(
    total: u64,
    platform: u64,
    community: u64,
    provider: u64,
    platform_bps: u16,
    community_bps: u16,
) -> Result<()> {
    require!(
        platform
            .checked_add(community)
            .and_then(|v| v.checked_add(provider))
            == Some(total),
        KnaError::SplitMismatch
    );
    let expected_platform = (total as u128)
        .checked_mul(platform_bps as u128)
        .ok_or(KnaError::Overflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(KnaError::Overflow)? as u64;
    let expected_community = (total as u128)
        .checked_mul(community_bps as u128)
        .ok_or(KnaError::Overflow)?
        .checked_div(BPS_DENOMINATOR as u128)
        .ok_or(KnaError::Overflow)? as u64;
    require!(platform == expected_platform, KnaError::SplitMismatch);
    require!(community == expected_community, KnaError::SplitMismatch);
    Ok(())
}

/// (mint, owner) of an initialized SPL token account owned by the Token program.
fn read_token_account(account: &AccountInfo) -> Result<(Pubkey, Pubkey)> {
    require_keys_eq!(*account.owner, TOKEN_PROGRAM_ID, KnaError::InvalidTokenAccount);
    let data = account.try_borrow_data()?;
    require!(data.len() == TOKEN_ACCOUNT_LEN, KnaError::InvalidTokenAccount);
    // state: 0 uninitialized, 1 initialized, 2 frozen
    require!(data[108] == 1, KnaError::InvalidTokenAccount);
    let mint = Pubkey::try_from(&data[0..32]).map_err(|_| error!(KnaError::InvalidTokenAccount))?;
    let owner = Pubkey::try_from(&data[32..64]).map_err(|_| error!(KnaError::InvalidTokenAccount))?;
    Ok((mint, owner))
}

/// Decimals of an initialized SPL mint owned by the Token program.
fn read_mint_decimals(account: &AccountInfo) -> Result<u8> {
    require_keys_eq!(*account.owner, TOKEN_PROGRAM_ID, KnaError::InvalidMint);
    let data = account.try_borrow_data()?;
    require!(data.len() == MINT_LEN && data[45] == 1, KnaError::InvalidMint);
    Ok(data[44])
}

/// CPI: SPL Token TransferChecked. `signer_seeds` is empty when a wallet signs.
#[allow(clippy::too_many_arguments)]
fn transfer_checked<'info>(
    token_program: &AccountInfo<'info>,
    from: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    authority: &AccountInfo<'info>,
    amount: u64,
    decimals: u8,
    signer_seeds: &[&[&[u8]]],
) -> Result<()> {
    use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
    let mut data = Vec::with_capacity(10);
    data.push(TOKEN_IX_TRANSFER_CHECKED);
    data.extend_from_slice(&amount.to_le_bytes());
    data.push(decimals);
    let ix = Instruction {
        program_id: TOKEN_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(from.key(), false),
            AccountMeta::new_readonly(mint.key(), false),
            AccountMeta::new(to.key(), false),
            AccountMeta::new_readonly(authority.key(), true),
        ],
        data,
    };
    anchor_lang::solana_program::program::invoke_signed(
        &ix,
        &[from.clone(), mint.clone(), to.clone(), authority.clone(), token_program.clone()],
        signer_seeds,
    )?;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + Config::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
pub struct GrantRole<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    /// CHECK: target wallet receiving the role grant PDA.
    pub wallet: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + RoleGrant::INIT_SPACE,
        seeds = [b"role", wallet.key().as_ref()],
        bump
    )]
    pub role_grant: Account<'info, RoleGrant>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeRole<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"role", role_grant.wallet.as_ref()], bump = role_grant.bump)]
    pub role_grant: Account<'info, RoleGrant>,
}

#[derive(Accounts)]
#[instruction(ledger_id_hash: [u8; 32])]
pub struct SubmitAttestation<'info> {
    #[account(mut)]
    pub coordinator: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [b"role", coordinator.key().as_ref()], bump = role_grant.bump)]
    pub role_grant: Account<'info, RoleGrant>,
    #[account(
        init,
        payer = coordinator,
        space = 8 + PendingAttestation::INIT_SPACE,
        seeds = [b"pending", ledger_id_hash.as_ref()],
        bump
    )]
    pub pending_attestation: Account<'info, PendingAttestation>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FinalizeAttestation<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [b"pending", pending_attestation.ledger_id_hash.as_ref()],
        bump = pending_attestation.bump
    )]
    pub pending_attestation: Account<'info, PendingAttestation>,
    #[account(
        init,
        payer = authority,
        space = 8 + FinalAttestation::INIT_SPACE,
        seeds = [b"final", pending_attestation.ledger_id_hash.as_ref()],
        bump
    )]
    pub final_attestation: Account<'info, FinalAttestation>,
    /// Optional when authority is the committee vault. When provided, must be
    /// the ROLE_COMMITTEE grant PDA for the signing authority.
    #[account(seeds = [b"role", authority.key().as_ref()], bump)]
    pub committee_role: Option<Account<'info, RoleGrant>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelPending<'info> {
    pub coordinator: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [b"role", coordinator.key().as_ref()], bump = role_grant.bump)]
    pub role_grant: Account<'info, RoleGrant>,
    #[account(
        mut,
        seeds = [b"pending", pending_attestation.ledger_id_hash.as_ref()],
        bump = pending_attestation.bump
    )]
    pub pending_attestation: Account<'info, PendingAttestation>,
}

#[derive(Accounts)]
#[instruction(ledger_id_hash: [u8; 32])]
pub struct AcknowledgeReceipt<'info> {
    #[account(mut)]
    pub guest: Signer<'info>,
    #[account(
        seeds = [b"final", ledger_id_hash.as_ref()],
        bump = final_attestation.bump
    )]
    pub final_attestation: Account<'info, FinalAttestation>,
    #[account(
        init,
        payer = guest,
        space = 8 + GuestReceipt::INIT_SPACE,
        seeds = [b"receipt", guest.key().as_ref(), ledger_id_hash.as_ref()],
        bump
    )]
    pub guest_receipt: Account<'info, GuestReceipt>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(archive_id_hash: [u8; 32])]
pub struct PublishArchiveProof<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = authority,
        space = 8 + ArchiveProof::INIT_SPACE,
        seeds = [b"archive", archive_id_hash.as_ref()],
        bump
    )]
    pub archive_proof: Account<'info, ArchiveProof>,
    #[account(seeds = [b"role", authority.key().as_ref()], bump)]
    pub committee_role: Option<Account<'info, RoleGrant>>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeArchiveProof<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        seeds = [b"archive", archive_proof.archive_id_hash.as_ref()],
        bump = archive_proof.bump
    )]
    pub archive_proof: Account<'info, ArchiveProof>,
    #[account(seeds = [b"role", authority.key().as_ref()], bump)]
    pub committee_role: Option<Account<'info, RoleGrant>>,
}

#[derive(Accounts)]
pub struct InitializePaymentConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = authority,
        space = 8 + PaymentConfig::INIT_SPACE,
        seeds = [b"payment_config"],
        bump
    )]
    pub payment_config: Account<'info, PaymentConfig>,
    /// CHECK: validated as an initialized SPL mint in the handler.
    pub mint: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdatePaymentConfig<'info> {
    pub authority: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"payment_config"], bump = payment_config.bump)]
    pub payment_config: Account<'info, PaymentConfig>,
}

#[derive(Accounts)]
#[instruction(user_hash: [u8; 32])]
pub struct RegisterAccount<'info> {
    #[account(mut)]
    pub registrar: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [b"role", registrar.key().as_ref()], bump = registrar_role.bump)]
    pub registrar_role: Account<'info, RoleGrant>,
    pub wallet: Signer<'info>,
    #[account(
        init,
        payer = registrar,
        space = 8 + AccountRecord::INIT_SPACE,
        seeds = [b"account", user_hash.as_ref()],
        bump
    )]
    pub account_record: Account<'info, AccountRecord>,
    #[account(
        init,
        payer = registrar,
        space = 8 + WalletRecord::INIT_SPACE,
        seeds = [b"wallet", wallet.key().as_ref()],
        bump
    )]
    pub wallet_record: Account<'info, WalletRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetAccountFlags<'info> {
    pub registrar: Signer<'info>,
    #[account(seeds = [b"role", registrar.key().as_ref()], bump = registrar_role.bump)]
    pub registrar_role: Account<'info, RoleGrant>,
    #[account(mut, seeds = [b"account", account_record.user_hash.as_ref()], bump = account_record.bump)]
    pub account_record: Account<'info, AccountRecord>,
}

#[derive(Accounts)]
pub struct SetPaymentWallet<'info> {
    pub wallet: Signer<'info>,
    pub payment_wallet: Signer<'info>,
    #[account(
        mut,
        seeds = [b"account", account_record.user_hash.as_ref()],
        bump = account_record.bump,
        constraint = account_record.wallet == wallet.key() @ KnaError::Unauthorized
    )]
    pub account_record: Account<'info, AccountRecord>,
}

#[derive(Accounts)]
#[instruction(booking_hash: [u8; 32])]
pub struct CreateBooking<'info> {
    #[account(mut)]
    pub registrar: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [b"role", registrar.key().as_ref()], bump = registrar_role.bump)]
    pub registrar_role: Account<'info, RoleGrant>,
    #[account(seeds = [b"account", guest_account.user_hash.as_ref()], bump = guest_account.bump)]
    pub guest_account: Account<'info, AccountRecord>,
    #[account(seeds = [b"account", provider_account.user_hash.as_ref()], bump = provider_account.bump)]
    pub provider_account: Account<'info, AccountRecord>,
    #[account(
        init,
        payer = registrar,
        space = 8 + BookingRecord::INIT_SPACE,
        seeds = [b"booking", booking_hash.as_ref()],
        bump
    )]
    pub booking: Account<'info, BookingRecord>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PayBooking<'info> {
    pub payer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [b"payment_config"], bump = payment_config.bump)]
    pub payment_config: Account<'info, PaymentConfig>,
    #[account(mut, seeds = [b"booking", booking.booking_hash.as_ref()], bump = booking.bump)]
    pub booking: Account<'info, BookingRecord>,
    #[account(seeds = [b"account", booking.guest_user_hash.as_ref()], bump = guest_account.bump)]
    pub guest_account: Account<'info, AccountRecord>,
    /// CHECK: must be the payment config's mint.
    #[account(address = payment_config.mint @ KnaError::InvalidMint)]
    pub mint: UncheckedAccount<'info>,
    /// CHECK: token account of `mint` owned by the payer.
    #[account(mut)]
    pub payer_token: UncheckedAccount<'info>,
    /// CHECK: token account of `mint` owned by booking.provider_wallet.
    #[account(mut)]
    pub provider_token: UncheckedAccount<'info>,
    /// CHECK: token account of `mint` owned by payment_config.community_wallet.
    #[account(mut)]
    pub community_token: UncheckedAccount<'info>,
    /// CHECK: token account of `mint` owned by payment_config.platform_wallet.
    #[account(mut)]
    pub platform_token: UncheckedAccount<'info>,
    /// CHECK: the SPL Token program.
    #[account(address = TOKEN_PROGRAM_ID)]
    pub token_program: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct UpdateBooking<'info> {
    pub registrar: Signer<'info>,
    #[account(seeds = [b"role", registrar.key().as_ref()], bump = registrar_role.bump)]
    pub registrar_role: Account<'info, RoleGrant>,
    #[account(mut, seeds = [b"booking", booking.booking_hash.as_ref()], bump = booking.bump)]
    pub booking: Account<'info, BookingRecord>,
}

#[account]
#[derive(InitSpace)]
pub struct PaymentConfig {
    pub mint: Pubkey,
    pub decimals: u8,
    pub units_per_vnd: u64,
    pub platform_wallet: Pubkey,
    pub community_wallet: Pubkey,
    pub bump: u8,
}

/// One KNĂ account ↔ one fixed wallet. `payment_wallet` is the wallet that
/// pays its bookings: the fixed wallet itself unless the user linked another.
#[account]
#[derive(InitSpace)]
pub struct AccountRecord {
    pub user_hash: [u8; 32],
    pub wallet: Pubkey,
    pub payment_wallet: Pubkey,
    pub flags: u8,
    pub registered_at: i64,
    pub bump: u8,
}

/// Reverse lookup (wallet → account), and the guarantee a wallet is
/// registered to one account only.
#[account]
#[derive(InitSpace)]
pub struct WalletRecord {
    pub wallet: Pubkey,
    pub user_hash: [u8; 32],
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct BookingRecord {
    pub booking_hash: [u8; 32],
    pub guest_user_hash: [u8; 32],
    pub provider_user_hash: [u8; 32],
    pub provider_wallet: Pubkey,
    pub check_in: i64,
    pub check_out: i64,
    pub total_vnd: u64,
    pub platform_vnd: u64,
    pub community_vnd: u64,
    pub provider_vnd: u64,
    pub status: u8,
    pub paid_by: Pubkey,
    pub paid_at: i64,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub version: u8,
    pub platform_fee_bps: u16,
    pub community_fee_bps: u16,
    pub coordinator_authority: Pubkey,
    pub committee_vault: Pubkey,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct RoleGrant {
    pub wallet: Pubkey,
    pub role: u8,
    pub revoked: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PendingAttestation {
    pub ledger_id_hash: [u8; 32],
    pub provider_hash: [u8; 32],
    pub content_hash: [u8; 32],
    pub total_vnd: u64,
    pub platform_vnd: u64,
    pub community_vnd: u64,
    pub provider_vnd: u64,
    pub recorded_at: i64,
    pub submitted_by: Pubkey,
    pub status: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct FinalAttestation {
    pub ledger_id_hash: [u8; 32],
    pub provider_hash: [u8; 32],
    pub content_hash: [u8; 32],
    pub total_vnd: u64,
    pub platform_vnd: u64,
    pub community_vnd: u64,
    pub provider_vnd: u64,
    pub recorded_at: i64,
    pub finalized_at: i64,
    pub finalized_by: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct GuestReceipt {
    pub ledger_id_hash: [u8; 32],
    pub guest: Pubkey,
    pub acknowledged_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ArchiveProof {
    pub archive_id_hash: [u8; 32],
    pub content_hash: [u8; 32],
    pub published_at: i64,
    pub revoked: bool,
    pub bump: u8,
}

#[event]
pub struct ConfigInitialized {
    pub authority: Pubkey,
    pub committee_vault: Pubkey,
    pub version: u8,
}

#[event]
pub struct PauseUpdated {
    pub paused: bool,
    pub authority: Pubkey,
}

#[event]
pub struct CommitteeVaultUpdated {
    pub committee_vault: Pubkey,
    pub authority: Pubkey,
}

#[event]
pub struct RoleGranted {
    pub wallet: Pubkey,
    pub role: u8,
}

#[event]
pub struct RoleRevoked {
    pub wallet: Pubkey,
    pub role: u8,
}

#[event]
pub struct AttestationSubmitted {
    pub ledger_id_hash: [u8; 32],
    pub content_hash: [u8; 32],
    pub total_vnd: u64,
    pub platform_vnd: u64,
    pub community_vnd: u64,
    pub provider_vnd: u64,
    pub submitted_by: Pubkey,
}

#[event]
pub struct AttestationFinalized {
    pub ledger_id_hash: [u8; 32],
    pub content_hash: [u8; 32],
    pub finalized_by: Pubkey,
    pub finalized_at: i64,
}

#[event]
pub struct AttestationCancelled {
    pub ledger_id_hash: [u8; 32],
    pub cancelled_by: Pubkey,
}

#[event]
pub struct ReceiptAcknowledged {
    pub ledger_id_hash: [u8; 32],
    pub guest: Pubkey,
    pub acknowledged_at: i64,
}

#[event]
pub struct ArchiveProofPublished {
    pub archive_id_hash: [u8; 32],
    pub content_hash: [u8; 32],
    pub published_by: Pubkey,
}

#[event]
pub struct ArchiveProofRevoked {
    pub archive_id_hash: [u8; 32],
    pub revoked_by: Pubkey,
}

#[event]
pub struct PaymentConfigSet {
    pub mint: Pubkey,
    pub platform_wallet: Pubkey,
    pub community_wallet: Pubkey,
    pub units_per_vnd: u64,
}

#[event]
pub struct AccountRegistered {
    pub user_hash: [u8; 32],
    pub wallet: Pubkey,
    pub flags: u8,
    pub registered_at: i64,
}

#[event]
pub struct AccountFlagsSet {
    pub user_hash: [u8; 32],
    pub flags: u8,
}

#[event]
pub struct PaymentWalletSet {
    pub user_hash: [u8; 32],
    pub wallet: Pubkey,
    pub payment_wallet: Pubkey,
}

#[event]
pub struct BookingCreated {
    pub booking_hash: [u8; 32],
    pub guest_user_hash: [u8; 32],
    pub provider_wallet: Pubkey,
    pub check_in: i64,
    pub check_out: i64,
    pub total_vnd: u64,
}

#[event]
pub struct BookingPaid {
    pub booking_hash: [u8; 32],
    pub paid_by: Pubkey,
    pub provider_vnd: u64,
    pub community_vnd: u64,
    pub platform_vnd: u64,
    pub paid_at: i64,
}

#[event]
pub struct BookingStatusChanged {
    pub booking_hash: [u8; 32],
    pub status: u8,
}

#[error_code]
pub enum KnaError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Program is paused")]
    Paused,
    #[msg("Invalid role")]
    InvalidRole,
    #[msg("Role has been revoked")]
    RoleRevoked,
    #[msg("Fee split does not match invariant")]
    SplitMismatch,
    #[msg("Invalid state transition")]
    InvalidState,
    #[msg("Attestation already exists")]
    AlreadyExists,
    #[msg("Arithmetic overflow")]
    Overflow,
    // Appended: Anchor numbers errors by position, and 6000–6007 are
    // already relied on by clients and docs/ERROR-MATRIX.md.
    // 6008 onwards: payments and bookings.
    #[msg("Token account is not the expected one")]
    InvalidTokenAccount,
    #[msg("Mint is not the payment mint")]
    InvalidMint,
    #[msg("Check-out must be after check-in, and cancellation before check-in")]
    InvalidDates,
    #[msg("Payment opens on the check-out date")]
    NotPayableYet,
    #[msg("The host account is not a registered provider")]
    NotProvider,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn booking_split_1m_vnd() {
        let total = 1_000_000u64;
        let platform = 70_000u64;
        let community = 30_000u64;
        let provider = 900_000u64;
        validate_split(total, platform, community, provider, 700, 300).unwrap();
    }

    #[test]
    fn rejects_bad_split() {
        assert!(validate_split(1_000_000, 80_000, 30_000, 890_000, 700, 300).is_err());
    }

    #[test]
    fn rejects_overflow_sum() {
        assert!(validate_split(u64::MAX, u64::MAX, 1, 0, 700, 300).is_err());
    }

    #[test]
    fn floor_split_small_total() {
        // 99 VND: floor(99*700/10000)=6, floor(99*300/10000)=2, provider=91
        validate_split(99, 6, 2, 91, 700, 300).unwrap();
        assert!(validate_split(99, 7, 2, 90, 700, 300).is_err());
    }

    #[test]
    fn rejects_parts_not_summing_to_total() {
        assert!(validate_split(1_000_000, 70_000, 30_000, 899_999, 700, 300).is_err());
    }

    #[test]
    fn token_program_id_is_spl_token() {
        use std::str::FromStr;
        assert_eq!(
            TOKEN_PROGRAM_ID,
            Pubkey::from_str("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA").unwrap()
        );
    }

    #[test]
    fn zero_total_ok() {
        validate_split(0, 0, 0, 0, 700, 300).unwrap();
    }
}
