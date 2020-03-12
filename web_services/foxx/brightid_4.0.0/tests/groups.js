"use strict";

const db = require('../db.js');
const arango = require('@arangodb').db;
const { hash } = require('../encoding');

const connectionsColl = arango._collection('connections');
const groupsColl = arango._collection('groups');
const newGroupsColl = arango._collection('newGroups');
const usersInGroupsColl = arango._collection('usersInGroups');
const usersInNewGroupsColl = arango._collection('usersInNewGroups');
const usersColl = arango._collection('users');
const invitationsColl = arango._collection('invitations');

const chai = require('chai');
const should = chai.should();
const expect = chai.expect;

describe('groups', function () {
  before(function(){
    usersColl.truncate();
    connectionsColl.truncate();
    groupsColl.truncate();
    usersInGroupsColl.truncate();
    newGroupsColl.truncate();
    usersInNewGroupsColl.truncate();
    invitationsColl.truncate();
    db.createUser('a');
    db.createUser('b');
    db.createUser('c');
    db.createUser('d');
    db.createUser('e');
    db.createUser('f');
    db.addConnection('b', 'c', 0);
    db.addConnection('b', 'd', 0);
  });
  after(function(){
    usersColl.truncate();
    connectionsColl.truncate();
    groupsColl.truncate();
    usersInGroupsColl.truncate();
    newGroupsColl.truncate();
    usersInNewGroupsColl.truncate();
    invitationsColl.truncate();
  });
  let groupId;
  it('should be able to create a group', function () {
     groupId = db.createGroup('b', 'c', 'd', 'general', Date.now());
     newGroupsColl.count().should.equal(1);
     newGroupsColl.any()._key.should.equal(groupId);
  });
  it('should be able to delete a group', function() {
    db.deleteGroup(groupId, 'b', Date.now());
    newGroupsColl.count().should.equal(0);
  })
  it('should be able to create the group again', function () {
    groupId = db.createGroup('b', 'c', 'd', 'general', Date.now());
    newGroupsColl.count().should.equal(1);
  newGroupsColl.any()._key.should.equal(groupId);
  });
  it('the two co-founders should be able to join the group', function (){
    db.addMembership(groupId, 'c', Date.now());
    db.addMembership(groupId, 'd', Date.now());
  });
  it('the group should be upgraded from a new group to a normal group', function (){
    groupsColl.count().should.equal(1);
  });

  describe('a user connected to all three members of a group', function() {
    before(function() {
      db.addConnection('a', 'b', 0);
      db.addConnection('a', 'c', 0);
      db.addConnection('a', 'd', 0);
    });

    it('should have three connections', function(){
      db.userConnections('a').length.should.equal(3);
    });
    it('should be eligible to join the group', function (){
      const eligibleGroups = db.updateEligibleGroups('a', db.userConnections('a'), []);
      eligibleGroups.should.not.be.empty;
      eligibleGroups[0].should.equal(groupId);
    });
    it('should not be able to join the group without invitation', function (){
      (() => {
        db.addMembership(groupId, 'a', Date.now());
      }).should.throw('not invited to join this group');
    });
    it('should be able to join the group after invitation', function (){
      db.invite('b', 'a', groupId, Date.now());
      db.addMembership(groupId, 'a', Date.now());
      usersInGroupsColl.count().should.equal(4);
    });
    it('should be able to leave the group', function (){
      db.deleteMembership(groupId, 'a', Date.now());
      usersInGroupsColl.count().should.equal(3);
    });
  });
  describe('flagging', function() {
    before(function() {
      db.addConnection('a', 'd', 0);
      db.addConnection('a', 'e', 0);
      db.addConnection('a', 'f', 0);
      db.addConnection('b', 'd', 0);
      db.addConnection('b', 'e', 0);
      db.addConnection('b', 'f', 0);
      db.addConnection('c', 'd', 0);
      db.addConnection('c', 'e', 0);
      db.addConnection('c', 'f', 0);
      db.invite('b', 'a', groupId, Date.now());
      db.addMembership(groupId, 'a', Date.now());
      db.invite('b', 'e', groupId, Date.now());
      db.addMembership(groupId, 'e', Date.now());
      db.invite('b', 'f', groupId, Date.now());
      db.addMembership(groupId, 'f', Date.now());
    });

    it('should not be able to flag someone without having connection', function(){
      (() => {
        db.removeConnection('e', 'f', 'duplicate', 0);
      }).should.throw('no connection found');
    });

    it('should be able to flag a connection', function(){
      db.removeConnection('b', 'a', 'duplicate', 0);
      usersColl.document('a').flaggers.should.deep.equal({'b': 'duplicate'});
      db.userConnections('b').should.not.include('a');
    });

    it('user should be removed from a group after being flagged by 2 members', function(){      
      db.removeConnection('c', 'a', 'duplicate', 0);
      usersColl.document('a').flaggers.should.deep.equal({'b': 'duplicate', 'c': 'duplicate'});
      db.userConnections('a').should.not.include('c');
      usersInGroupsColl.byExample({'_from': 'users/a'}).count().should.equal(0);
      usersInGroupsColl.byExample({'_from': 'users/b'}).count().should.equal(1);
      usersInGroupsColl.byExample({'_from': 'users/c'}).count().should.equal(1);
    });

    it('flagged user should not be able to join a group that is flagged by 2 members', function(){
      (() => {
        db.invite('b', 'a', groupId, Date.now());
        db.addMembership(groupId, 'a', Date.now());
      }).should.throw('user is flagged by two or more members of the group');
    });

    it('should be able to remove a flag by making connection again', function(){
      db.addConnection('a', 'b', 0);
      usersColl.document('a').flaggers.should.deep.equal({'c': 'duplicate'});
    });
  });

  describe('inviting', function() {
    before(function() {
      db.createUser('g');
      db.addConnection('a', 'b', 0);
      db.addConnection('a', 'c', 0);
      db.addConnection('a', 'd', 0);
      db.addConnection('b', 'd', 0);
      db.addConnection('c', 'd', 0);
      groupId = db.createGroup('a', 'b', 'c', 'general', Date.now());
      db.addMembership(groupId, 'b', Date.now());
      db.addMembership(groupId, 'c', Date.now());
    });
    it('no one should be able to join an invite only group without invitation', function (){
      (() => {
        db.addMembership(groupId, 'd', Date.now());
      }).should.throw('not invited to join this group');
    });
    it('admins should not be able to invite non-eligible users to the group', function (){
      (() => {
        db.invite('a', 'g', groupId, Date.now());
      }).should.throw('invitee is not eligible to join this group');
    });
    it('admins should be able to invite eligible users to the group', function (){
      db.invite('b', 'd', groupId, Date.now());
      db.userInvitedGroups('d').map(group => group.id).should.deep.equal([groupId]);
    });
    it('invited user should be able to join the group', function (){
      db.addMembership(groupId, 'd', Date.now());
      db.groupMembers(groupId).should.include('d');
      db.userInvitedGroups('d').length.should.equal(0);
    });
    it('non-admins should not be able to invite others to the group', function (){
      (() => {
        db.invite('d', 'e', groupId, Date.now());
      }).should.throw('inviter is not admin of group');
    });
  });

  describe('dismissing', function() {
    before(function() {
      db.invite('b', 'd', groupId, Date.now());
      db.invite('b', 'e', groupId, Date.now());
      db.addMembership(groupId, 'd', Date.now());
      db.addMembership(groupId, 'e', Date.now());
    });
    it('non-admins should not be able to dismiss others from the group', function (){
      (() => {
        db.dismiss('d', 'e', groupId, Date.now());
      }).should.throw('dismisser is not admin of group');
    });
    it('admins should be able to dismiss others from the group', function (){
      db.dismiss('b', 'd', groupId, Date.now());
      db.groupMembers(groupId).should.not.include('d');
    });
    it('admins should not be able to dismiss each other from the group', function (){
      (() => {
        db.dismiss('b', 'c', groupId, Date.now());
      }).should.throw('admins can not be dismissed from group');
    });
  });

  describe('adding new admins', function() {
    before(function() {
      db.invite('b', 'd', groupId, Date.now());
      db.addMembership(groupId, 'd', Date.now());
    });
    it('non-admins should not be able to add new admins', function (){
      (() => {
        db.addAdmin('e', 'd', groupId, Date.now());
      }).should.throw('only admins can add new admins');
    });
    it('admins should be able to add new admins', function (){
      db.addAdmin('b', 'd', groupId, Date.now());
      groupsColl.document(groupId).admins.should.include('d');
    });
    it('new admins should be able to dismiss others from the group', function (){
      db.dismiss('d', 'e', groupId, Date.now());
      db.groupMembers(groupId).should.not.include('e');
    });
    it('admins should be removed from admins list when they leave the group', function (){
      groupsColl.document(groupId).admins.should.include('d');
      db.deleteMembership(groupId, 'd', Date.now());
      groupsColl.document(groupId).admins.should.not.include('d');
    });
  });

  describe('primary groups', function() {
    before(function() {
      groupsColl.truncate();
      newGroupsColl.truncate();
      usersInGroupsColl.truncate();
      usersInNewGroupsColl.truncate();
      groupId = db.createGroup('a', 'b', 'c', 'primary', Date.now());
      db.addMembership(groupId, 'b', Date.now());
      db.addMembership(groupId, 'c', Date.now());
    });
    it('users that have primary groups should not be able to create new primary groups', function (){
      (() => {
        db.createGroup('a', 'd', 'e', 'primary', Date.now());
      }).should.throw('some of founders already have primary groups');
    });
    it('users with no primary group should be able to join a primary group', function (){
      db.invite('a', 'd', groupId, Date.now());
      db.addMembership(groupId, 'd', Date.now());
      db.userCurrentGroups('d').map(group => group.id).should.deep.equal([groupId]);
    });
    it('users that have primary groups should not be able to invited to other primary groups', function (){
      db.addConnection('e', 'f', Date.now());
      db.addConnection('e', 'g', Date.now());
      const newGroupId = db.createGroup('e', 'f', 'g', 'primary', Date.now());
      db.addMembership(newGroupId, 'f', Date.now());
      db.addMembership(newGroupId, 'g', Date.now());
      (() => {
        db.invite('a', 'e', groupId, Date.now());
      }).should.throw('user already has a primary group');

    });
  });

});