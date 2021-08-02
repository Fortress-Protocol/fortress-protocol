Fortress Protocol
=================

The Fortress Protocol is an Binance Smart Chain smart contract for supplying or borrowing assets. Through the fToken contracts, accounts on the blockchain *supply* capital (BNB or BEP-20 tokens) to receive fTokens or *borrow* assets from the protocol (holding other assets as collateral).
The Fortress fToken contracts track these balances and algorithmically set interest rates for borrowers.

Before getting started with this repo, please read:

Contracts
=========

We detail a few of the core contracts in the Fortress protocol.

<dl>
  <dt>FToken, FBep20 and FBNB</dt>
  <dd>The Fortress fTokens, which are self-contained borrowing and lending contracts. FToken contains the core logic and FBep20, FBUSD and FBNB add public interfaces for Bep20 tokens and bnb, respectively. Each FToken is assigned an interest rate and risk model (see InterestRateModel and Comptroller sections), and allows accounts to *mint* (supply capital), *redeem* (withdraw capital), *borrow* and *repay a borrow*. Each FToken is an BEP-20 compliant token where balances represent ownership of the market.</dd>
</dl>

<dl>
  <dt>Comptroller</dt>
  <dd>The risk model contract, which validates permissible user actions and disallows actions if they do not fit certain risk parameters. For instance, the Comptroller enforces that each borrowing user must maintain a sufficient collateral balance across all fTokens.</dd>
</dl>

<dl>
  <dt>FTS</dt>
  <dd>The Fortress Governance Token (FTS). Holders of this token have the ability to govern the protocol via the governor contract.</dd>
</dl>

<dl>
  <dt>Governor Alpha</dt>
  <dd>The administrator of the Fortress timelock contract. Holders of FTS token may create and vote on proposals which will be queued into the Fortress timelock and then have effects on Fortress fToken and Comptroller contracts. This contract may be replaced in the future with a beta version.</dd>
</dl>

<dl>
  <dt>InterestRateModel</dt>
  <dd>Contracts which define interest rate models. These models algorithmically determine interest rates based on the current utilization of a given market (that is, how much of the supplied assets are liquid versus borrowed).</dd>
</dl>

<dl>
  <dt>Careful Math</dt>
  <dd>Library for safe math operations.</dd>
</dl>

<dl>
  <dt>ErrorReporter</dt>
  <dd>Library for tracking error codes and failure conditions.</dd>
</dl>

<dl>
  <dt>Exponential</dt>
  <dd>Library for handling fixed-point decimal numbers.</dd>
</dl>

<dl>
  <dt>SafeToken</dt>
  <dd>Library for safely handling Bep20 interaction.</dd>
</dl>

<dl>
  <dt>WhitePaperInterestRateModel</dt>
  <dd>Initial interest rate model, as defined in the Whitepaper. This contract accepts a base rate and slope parameter in its constructor.</dd>
</dl>

Installation
------------
To run fortress, pull the repository from GitHub and install its dependencies. You will need [yarn](https://yarnpkg.com/lang/en/docs/install/) or [npm](https://docs.npmjs.com/cli/install) installed.

    git clone https://github.com/Fortress-Protocol/fortress-protocol
    cd fortress-protocol
    yarn install --lock-file # or `npm install`

Integration Specs
-----------------

There are additional tests under the [spec/scenario](https://github.com/Fortress-Protocol/fortress-protocol/tree/master/spec/scenario) folder. These are high-level integration tests based on the scenario runner depicted above. The aim of these tests is to be highly literate and have high coverage in the interaction of contracts.
