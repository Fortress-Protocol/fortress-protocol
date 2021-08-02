
# Run a single cvl e.g.:
#  make -B spec/certora/FBep20/borrowAndRepayFresh.cvl

# TODO:
#  - mintAndRedeemFresh.cvl in progress and is failing due to issues with tool proving how the exchange rate can change
#    hoping for better division modelling - currently fails to prove (a + 1) / b >= a / b
#  - FBep20Delegator/*.cvl cannot yet be run with the tool
#  - fDAI proofs are WIP, require using the delegate and the new revert message assertions

.PHONY: certora-clean

CERTORA_BIN = $(abspath script/certora)
CERTORA_RUN = $(CERTORA_BIN)/run.py
CERTORA_CLI = $(CERTORA_BIN)/cli.jar
CERTORA_EMV = $(CERTORA_BIN)/emv.jar

export CERTORA = $(CERTORA_BIN)
export CERTORA_DISABLE_POPUP = 1

spec/certora/Math/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/MathCertora.sol \
	--verify \
	 MathCertora:$@

spec/certora/FTS/search.cvl:
	$(CERTORA_RUN) \
	spec/certora/contracts/FTSCertora.sol \
	--settings -b=4,-graphDrawLimit=0,-assumeUnwindCond,-depth=100 \
	--solc_args "'--evm-version istanbul'" \
	--verify \
	 FTSCertora:$@

spec/certora/FTS/transfer.cvl:
	$(CERTORA_RUN) \
	spec/certora/contracts/FTSCertora.sol \
	--settings -graphDrawLimit=0,-assumeUnwindCond,-depth=100 \
	--solc_args "'--evm-version istanbul'" \
	--verify \
	 FTSCertora:$@

spec/certora/Governor/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/GovernorAlphaCertora.sol \
	 spec/certora/contracts/TimelockCertora.sol \
	 spec/certora/contracts/FTSCertora.sol \
	 --settings -assumeUnwindCond,-enableWildcardInlining=false \
	 --solc_args "'--evm-version istanbul'" \
	 --link \
	 GovernorAlphaCertora:timelock=TimelockCertora \
	 GovernorAlphaCertora:fts=FTSCertora \
	--verify \
	 GovernorAlphaCertora:$@

spec/certora/Comptroller/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/ComptrollerCertora.sol \
	 spec/certora/contracts/PriceOracleModel.sol \
	--link \
	 ComptrollerCertora:oracle=PriceOracleModel \
	--verify \
	 ComptrollerCertora:$@

spec/certora/fDAI/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/FDaiDelegateCertora.sol \
	 spec/certora/contracts/UnderlyingModelNonStandard.sol \
	 spec/certora/contracts/mcd/dai.sol:Dai \
	 spec/certora/contracts/mcd/pot.sol:Pot \
	 spec/certora/contracts/mcd/vat.sol:Vat \
	 spec/certora/contracts/mcd/join.sol:DaiJoin \
	 tests/Contracts/BoolComptroller.sol \
	--link \
	 FDaiDelegateCertora:comptroller=BoolComptroller \
	 FDaiDelegateCertora:underlying=Dai \
	 FDaiDelegateCertora:potAddress=Pot \
	 FDaiDelegateCertora:vatAddress=Vat \
	 FDaiDelegateCertora:daiJoinAddress=DaiJoin \
	--verify \
	 FDaiDelegateCertora:$@ \
	--settings -cache=certora-run-fdai

spec/certora/FBep20/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/FBep20ImmutableCertora.sol \
	 spec/certora/contracts/FTokenCollateral.sol \
	 spec/certora/contracts/ComptrollerCertora.sol \
	 spec/certora/contracts/InterestRateModelModel.sol \
	 spec/certora/contracts/UnderlyingModelNonStandard.sol \
	--link \
	 FBep20ImmutableCertora:otherToken=FTokenCollateral \
	 FBep20ImmutableCertora:comptroller=ComptrollerCertora \
	 FBep20ImmutableCertora:underlying=UnderlyingModelNonStandard \
	 FBep20ImmutableCertora:interestRateModel=InterestRateModelModel \
	 FTokenCollateral:comptroller=ComptrollerCertora \
	 FTokenCollateral:underlying=UnderlyingModelNonStandard \
	--verify \
	 FBep20ImmutableCertora:$@ \
	--settings -cache=certora-run-fbep20-immutable

spec/certora/FBep20Delegator/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/FBep20DelegatorCertora.sol \
	 spec/certora/contracts/FBep20DelegateCertora.sol \
	 spec/certora/contracts/FTokenCollateral.sol \
	 spec/certora/contracts/ComptrollerCertora.sol \
	 spec/certora/contracts/InterestRateModelModel.sol \
	 spec/certora/contracts/UnderlyingModelNonStandard.sol \
	--link \
	 FBep20DelegatorCertora:implementation=FBep20DelegateCertora \
	 FBep20DelegatorCertora:otherToken=FTokenCollateral \
	 FBep20DelegatorCertora:comptroller=ComptrollerCertora \
	 FBep20DelegatorCertora:underlying=UnderlyingModelNonStandard \
	 FBep20DelegatorCertora:interestRateModel=InterestRateModelModel \
	 FTokenCollateral:comptroller=ComptrollerCertora \
	 FTokenCollateral:underlying=UnderlyingModelNonStandard \
	--verify \
	 FBep20DelegatorCertora:$@ \
	--settings -assumeUnwindCond \
	--settings -cache=certora-run-fbep20-delegator

spec/certora/Maximillion/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/MaximillionCertora.sol \
	 spec/certora/contracts/FBNBCertora.sol \
	--link \
	 MaximillionCertora:fBnb=FBNBCertora \
	--verify \
	 MaximillionCertora:$@

spec/certora/Timelock/%.cvl:
	$(CERTORA_RUN) \
	 spec/certora/contracts/TimelockCertora.sol \
	--verify \
	 TimelockCertora:$@

certora-clean:
	rm -rf .certora_build.json .certora_config certora_verify.json emv-*
