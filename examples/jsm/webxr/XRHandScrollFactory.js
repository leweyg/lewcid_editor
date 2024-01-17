
import * as THREE from 'three';
import { XRHandPrimitiveModel } from './XRHandPrimitiveModel.js';
import { XRHandMeshModel } from './XRHandMeshModel.js';

class XRFingerJoint {
    constructor(fingerState, jointPostfix) {
        this.fingerState = fingerState;
        this.jointName = fingerState.nameFinger + jointPostfix;
        this.name = this.jointName;
        this.position = new THREE.Vector3();
        this.rotation = new THREE.Euler();
        this.found = false;
    }

    updateJointFromSource() {
        var srcJoint = this.fingerState.handScrollState.getSourceJointByName(this.jointName);
        if (srcJoint) {
            this.found = true;
            var pos = srcJoint.position;
            if (Array.isArray(pos)) {
                this.position.set(pos[0], pos[1], pos[2]);
            } else {
                this.position.copy( srcJoint.position );
            }
            var rot = srcJoint.rotation;
            if (Array.isArray(rot)) {
                this.rotation.set(rot[0], rot[1], rot[2]);
            } else {
                this.rotation.copy( srcJoint.rotation );
            }
        } else if (this.found) {
            this.found = false;
        }
        return this.found;

    }
};

class XRFingerState {

    constructor(handScrollState, nameFinger, isThumb=false) {
        // sources:
        this.name = nameFinger;
        this.handScrollState = handScrollState;
        this.isThumb = isThumb;
        this.nameFinger = nameFinger;
        this.jointWrist = new XRFingerJoint(this, "-metacarpal");
        this.jointProximal = new XRFingerJoint(this, "-phalanx-proximal" );
        this.jointBend = new XRFingerJoint(this, isThumb ? "-phalanx-distal" : "-phalanx-intermediate");
        this.jointTip = new XRFingerJoint(this, "-tip");
        this.joints = [ this.jointWrist, this.jointProximal, this.jointBend, this.jointTip ];
        // state:
        this.fingerFound = false;
        this.tendonContracted = false;
        this.tendonRelaxed = true;
        this.tendonProtracted = false;
    }

    updateFingerFromSource() {
        for (var i in this.joints) {
            var joint = this.joints[i];
            if (!joint.updateJointFromSource()) {
                this.fingerFound = false;
                return false;
            }
        }
        this.fingerFound = true;
        // calculate tensor state:

        // result:
        return this.fingerFound;
    }
};

class XRHandScrollCursor {
    constructor(handScrollState) {
        this.handScrollState = handScrollState;
    }

    updateCursorFromSource() {

    }
};

class XRHandScrollState {

    constructor(arms, handSource, isRightHand) {
        // sources:
        this.arms = arms;
        this.handSource = handSource;
        this.isRightHand = isRightHand;
        this.fingerThumb = new XRFingerState(this, "thumb", true);
        this.fingerIndex = new XRFingerState(this, "index-finger");
        this.fingerMiddle = new XRFingerState(this, "middle-finger");
        this.fingerRing = new XRFingerState(this, "ring-finger");
        this.fingerPinky = new XRFingerState(this, "pinky-finger");
        this.fingers = [ this.fingerThumb, this.fingerIndex, this.fingerMiddle,
            this.fingerRing, this.fingerPinky ];
        // state:
        this.handFound = false;
        this.handPoseIndex = 0;
        this.handPosesByIndex = [
            "unknown", "inactive",
            "open", "pointing", "closed",
            "plane-down", "plane-towards", "plane-side",
            "pinch-near", "pinch-active",
        ];
        this.handPose = this.handPosesByIndex[ this.handPoseIndex ];
        this.cursor = new XRHandScrollCursor(this);
    }

    updateHandFromSource() {
        var anyMissing = false;
        for (var i in this.fingers) {
            var finger = this.fingers[i];
            if (!finger.updateFingerFromSource()) {
                anyMissing = true;
            }
        }
        this.handFound = !anyMissing;
        this.cursor.updateCursorFromSource();
        return this.handFound;
    }

    getSourceJointByName(jointName) {
        if (!this.handSource) return null;
        if (!this.handSource.children) return null;
        var source = this.handSource;
        var kids = this.handSource.children;
        if ((kids.length == 1) && (kids[0].name == "Armature")) {
            source = this.handSource.children[0];
            kids = source.children;
        }
        for (var i in kids) {
            var child = kids[i];
            if (child.name == jointName) {
                return child;
            }
        }
        return null;
    }
};

class XRArmsScrollState {
    constructor(headSource, handSourceLeft, handSourceRight) {
        // sources:
        this.head = headSource;
        this.left = new XRHandScrollState(this, handSourceLeft, false);
        this.right= new XRHandScrollState(this, handSourceRight, true);
        this.hands = [ this.left, this.right ];
        // state:
        this.armPoseIndex = 0;
        this.armPosesByIndex = [
            "unknown", "inactive", "indepenant",
            "dual-side-zoom", "dual-down-balance", "dual-towards-turn"
        ];
        this.armPose = this.armPosesByIndex[ this.armPoseIndex ];
    }

    updateArmsFromSource() {
        for (var i in this.hands) {
            var hand = this.hands[i];
            hand.updateHandFromSource();
        }
        // update dual-hand arm pose:
    }
};

export {
    XRArmsScrollState,
    XRHandScrollState,
    XRFingerState,
    XRHandScrollCursor,
};

