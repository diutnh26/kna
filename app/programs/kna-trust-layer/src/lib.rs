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
    fn zero_total_ok() {
        validate_split(0, 0, 0, 0, 700, 300).unwrap();
    }
}
