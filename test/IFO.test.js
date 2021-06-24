const { expectRevert, time } = require('@openzeppelin/test-helpers');
const { assert } = require("chai");

const MockBEP20 = artifacts.require('MockBEP20');
const IFO = artifacts.require('IFO');
const H2OToken = artifacts.require('H2OToken');
const MasterChef = artifacts.require('MasterChef');

contract('IFO', ([alice, bob, carol, dev, fee, minter]) => {
  beforeEach(async () => {
    this.h2o = await H2OToken.new({ from: minter });
    this.lp = await MockBEP20.new('LPToken', 'LP1', '1000000', { from: minter });
    this.ifoToken = await MockBEP20.new('WOW', 'WOW', '1000000', { from: minter });
    this.chef = await MasterChef.new(this.h2o.address, dev, fee, '1000', '10', { from: minter });
    await this.h2o.transferOwnership(this.chef.address, { from: minter });
    await this.chef.add('1000', this.lp.address, '0', true, { from: minter });

    await this.lp.transfer(bob, '10', { from: minter });
    await this.lp.transfer(alice, '10', { from: minter });
    await this.lp.transfer(carol, '10', { from: minter });
  });

  it('raise not enough lp', async () => {
    // 10 lp raising, 100 ifo to offer
    this.ifo = await IFO.new(
      this.lp.address,
      this.ifoToken.address,
      '20',
      '30',
      '100',
      '10',
      alice,
      this.chef.address,
      '1',
      this.h2o.address,
      { from: minter }
    );
    await this.ifoToken.transfer(this.ifo.address, '100', { from: minter });
    await this.ifo.approve({ from: alice });

    await this.lp.approve(this.ifo.address, '1000', { from: alice });
    await this.lp.approve(this.ifo.address, '1000', { from: bob });
    await this.lp.approve(this.ifo.address, '1000', { from: carol });
    await expectRevert(
      this.ifo.deposit('1', { from: bob }),
      'not ifo time',
    );

    await time.advanceBlockTo('20');

    await this.ifo.deposit('1', { from: bob });
    await this.ifo.deposit('2', { from: alice });
    await this.ifo.deposit('3', { from: carol });
    assert.equal((await this.ifo.totalAmount()).toString(), '6');
    assert.equal((await this.lp.balanceOf(this.ifo.address)).toString(), '0');
    assert.equal((await this.chef.userInfo('1', this.ifo.address)).amount.toString(), '6');
    assert.equal((await this.ifo.getUserAllocation(carol)).toString(), '500000');
    assert.equal((await this.ifo.getUserAllocation(alice)).toString(), '333333');
    assert.equal((await this.ifo.getOfferingAmount(carol)).toString(), '30');
    assert.equal((await this.ifo.getOfferingAmount(bob)).toString(), '10');
    assert.equal((await this.ifo.getRefundingAmount(bob)).toString(), '0');
    await expectRevert(
      this.ifo.harvest({ from: bob }),
      'not harvest time',
    );

    await time.advanceBlockTo('29');
    assert.equal((await this.lp.balanceOf(carol)).toString(), '7');
    assert.equal((await this.ifoToken.balanceOf(carol)).toString(), '0');
    assert.equal((await this.h2o.balanceOf(carol)).toString(), '0');
    await expectRevert(
      this.ifo.harvest({ from: carol }),
      'not harvest time',
    );

    await time.advanceBlockTo('31');
    await expectRevert(
      this.ifo.harvest({ from: carol }),
      'Farming not end',
    );

    await this.ifo.endFarmStaking({ from: alice });
    assert.equal((await this.lp.balanceOf(this.ifo.address)).toString(), '6');
    const ifoTotalFarmingReward = (await this.h2o.balanceOf(this.ifo.address)).toNumber();
    assert.isAbove(ifoTotalFarmingReward, 0);

    await this.ifo.harvest({ from: carol });
    assert.equal((await this.lp.balanceOf(carol)).toString(), '7');
    assert.equal((await this.ifoToken.balanceOf(carol)).toString(), '30');
    assert.equal((await this.h2o.balanceOf(carol)).toNumber(), (await this.ifo.getUserAllocation(carol)).toNumber() / 1000000 * ifoTotalFarmingReward);

    await expectRevert(
      this.ifo.harvest({ from: carol }),
      'nothing to harvest',
    );

  })

  it('raise enough++ lp', async () => {
    // 10 lp raising, 100 ifo to offer
    this.ifo = await IFO.new(
      this.lp.address,
      this.ifoToken.address,
      '100',
      '150',
      '100',
      '10',
      alice,
      this.chef.address,
      '1',
      this.h2o.address,
      { from: minter }
    );

    await this.ifoToken.transfer(this.ifo.address, '100', { from: minter });
    await this.ifo.approve({ from: alice });

    await this.lp.approve(this.ifo.address, '1000', { from: alice });
    await this.lp.approve(this.ifo.address, '1000', { from: bob });
    await this.lp.approve(this.ifo.address, '1000', { from: carol });
    await expectRevert(
      this.ifo.deposit('1', { from: bob }),
      'not ifo time',
    );

    await time.advanceBlockTo('100');

    await this.ifo.deposit('1', { from: bob });
    await this.ifo.deposit('2', { from: alice });
    await this.ifo.deposit('3', { from: carol });
    await this.ifo.deposit('1', { from: bob });
    await this.ifo.deposit('2', { from: alice });
    await this.ifo.deposit('3', { from: carol });
    await this.ifo.deposit('1', { from: bob });
    await this.ifo.deposit('2', { from: alice });
    await this.ifo.deposit('3', { from: carol });
    assert.equal((await this.ifo.totalAmount()).toString(), '18');
    assert.equal((await this.lp.balanceOf(this.ifo.address)).toString(), '0');
    assert.equal((await this.chef.userInfo('1', this.ifo.address)).amount.toString(), '18');
    assert.equal((await this.ifo.getUserAllocation(carol)).toString(), '500000');
    assert.equal((await this.ifo.getUserAllocation(alice)).toString(), '333333');
    assert.equal((await this.ifo.getOfferingAmount(carol)).toString(), '50');
    assert.equal((await this.ifo.getOfferingAmount(bob)).toString(), '16');
    assert.equal((await this.ifo.getRefundingAmount(carol)).toString(), '4');
    assert.equal((await this.ifo.getRefundingAmount(bob)).toString(), '2');
    await expectRevert(
      this.ifo.harvest({ from: bob }),
      'not harvest time',
    );
    assert.equal((await this.ifo.totalAmount()).toString(), '18');

    await time.advanceBlockTo('150');
    assert.equal((await this.lp.balanceOf(carol)).toString(), '1');
    assert.equal((await this.ifoToken.balanceOf(carol)).toString(), '0');

    await expectRevert(
      this.ifo.harvest({ from: carol }),
      'Farming not end',
    );

    await this.ifo.endFarmStaking({ from: alice });
    assert.equal((await this.lp.balanceOf(this.ifo.address)).toString(), '18');
    const ifoTotalFarmingReward = (await this.h2o.balanceOf(this.ifo.address)).toNumber();
    assert.isAbove(ifoTotalFarmingReward, 0);

    await this.ifo.harvest({ from: carol });
    assert.equal((await this.lp.balanceOf(carol)).toString(), '5');
    assert.equal((await this.ifoToken.balanceOf(carol)).toString(), '50');
    assert.equal((await this.h2o.balanceOf(carol)).toNumber(), Math.floor((await this.ifo.getUserAllocation(carol)).toNumber() / 1000000 * ifoTotalFarmingReward));

    await expectRevert(
      this.ifo.harvest({ from: carol }),
      'nothing to harvest',
    );
    assert.equal((await this.ifo.hasHarvest(carol)).toString(), 'true');
    assert.equal((await this.ifo.hasHarvest(bob)).toString(), 'false');

  })

  it('raise enough lp', async () => {
    // 10 lp raising, 100 ifo to offer
    this.ifo = await IFO.new(
      this.lp.address,
      this.ifoToken.address,
      '200',
      '250',
      '18',
      '18',
      alice,
      this.chef.address,
      '1',
      this.h2o.address,
      { from: minter }
    );

    await this.ifoToken.transfer(this.ifo.address, '100', { from: minter });
    await this.ifo.approve({ from: alice });

    await this.lp.approve(this.ifo.address, '1000', { from: alice });
    await this.lp.approve(this.ifo.address, '1000', { from: bob });
    await this.lp.approve(this.ifo.address, '1000', { from: carol });
    await expectRevert(
      this.ifo.deposit('1', { from: bob }),
      'not ifo time',
    );

    await time.advanceBlockTo('200');

    await this.ifo.deposit('1', { from: bob });
    await this.ifo.deposit('2', { from: alice });
    await this.ifo.deposit('3', { from: carol });
    await this.ifo.deposit('1', { from: bob });
    await this.ifo.deposit('2', { from: alice });
    await this.ifo.deposit('3', { from: carol });
    await this.ifo.deposit('1', { from: bob });
    await this.ifo.deposit('2', { from: alice });
    await this.ifo.deposit('3', { from: carol });
    assert.equal((await this.ifo.totalAmount()).toString(), '18');
    assert.equal((await this.lp.balanceOf(this.ifo.address)).toString(), '0');
    assert.equal((await this.chef.userInfo('1', this.ifo.address)).amount.toString(), '18');
    assert.equal((await this.ifo.getUserAllocation(carol)).toString(), '500000');
    assert.equal((await this.ifo.getUserAllocation(alice)).toString(), '333333');
    assert.equal((await this.ifo.getOfferingAmount(carol)).toString(), '9');
    assert.equal((await this.ifo.getOfferingAmount(minter)).toString(), '0');
    assert.equal((await this.ifo.getOfferingAmount(bob)).toString(), '3');
    assert.equal((await this.ifo.getRefundingAmount(carol)).toString(), '0');
    assert.equal((await this.ifo.getRefundingAmount(bob)).toString(), '0');
    await expectRevert(
      this.ifo.harvest({ from: bob }),
      'not harvest time',
    );
    assert.equal((await this.ifo.totalAmount()).toString(), '18');

    await time.advanceBlockTo('250');
    assert.equal((await this.lp.balanceOf(carol)).toString(), '1');
    assert.equal((await this.ifoToken.balanceOf(carol)).toString(), '0');

    await expectRevert(
      this.ifo.harvest({ from: carol }),
      'Farming not end',
    );

    await this.ifo.endFarmStaking({ from: alice });
    assert.equal((await this.lp.balanceOf(this.ifo.address)).toString(), '18');
    const ifoTotalFarmingReward = (await this.h2o.balanceOf(this.ifo.address)).toNumber();
    assert.isAbove(ifoTotalFarmingReward, 0);

    await this.ifo.harvest({ from: carol });
    assert.equal((await this.lp.balanceOf(carol)).toString(), '1');
    assert.equal((await this.ifoToken.balanceOf(carol)).toString(), '9');
    assert.equal((await this.h2o.balanceOf(carol)).toNumber(), Math.floor((await this.ifo.getUserAllocation(carol)).toNumber() / 1000000 * ifoTotalFarmingReward));

    await expectRevert(
      this.ifo.harvest({ from: carol }),
      'nothing to harvest',
    );
    assert.equal((await this.ifo.hasHarvest(carol)).toString(), 'true');
    assert.equal((await this.ifo.hasHarvest(bob)).toString(), 'false');
    assert.equal((await this.ifo.getAddressListLength()).toString(), '3');
  })

  it('final withdraw', async () => {
    this.ifo = await IFO.new(
      this.lp.address,
      this.ifoToken.address,
      '350',
      '400',
      '18',
      '18',
      alice,
      this.chef.address,
      '1',
      this.h2o.address,
      { from: minter }
    );

    await this.ifoToken.transfer(this.ifo.address, '100', { from: minter });
    await this.ifo.approve({ from: alice });

    await this.lp.approve(this.ifo.address, '1000', { from: alice });
    await this.lp.approve(this.ifo.address, '1000', { from: bob });
    await this.lp.approve(this.ifo.address, '1000', { from: carol });
    await expectRevert(
      this.ifo.deposit('1', { from: bob }),
      'not ifo time',
    );

    await time.advanceBlockTo('350');

    await this.ifo.deposit('1', { from: bob });
    await this.ifo.deposit('2', { from: alice });
    await this.ifo.deposit('3', { from: carol });
    await this.ifo.deposit('1', { from: bob });
    await this.ifo.deposit('2', { from: alice });
    await this.ifo.deposit('3', { from: carol });
    await this.ifo.deposit('1', { from: bob });
    await this.ifo.deposit('2', { from: alice });
    await this.ifo.deposit('3', { from: carol });

    await expectRevert(
      this.ifo.finalWithdrawLPToken('1', { from: bob }),
      'admin: wut?',
    );

    await expectRevert(
      this.ifo.finalWithdrawLPToken('1', { from: alice }),
      'IFO not end',
    );

    await time.advanceBlockTo('400');

    await this.ifo.endFarmStaking({ from: alice });
    await this.ifo.finalWithdrawLPToken('18', { from: alice });

    assert.equal((await this.lp.balanceOf(alice)).toString(), '22');

    await expectRevert(
      this.ifo.finalWithdrawOfferingToken('1', { from: bob }),
      'admin: wut?',
    );

    await expectRevert(
      this.ifo.finalWithdrawOfferingToken('1', { from: alice }),
      'not after 2 days of IFO ended',
    );
  })
});
