
import * as THREE from 'three';
import { XRHandPrimitiveModel } from './XRHandPrimitiveModel.js';
import { XRHandMeshModel } from './XRHandMeshModel.js';

class XRFingerJoint {
    constructor(fingerState, jointPostfix) {
        this.fingerState = fingerState;
        this.name = fingerState.nameFinger + jointPostfix;
        this.position = new THREE.Vector3();
        this.rotation = new THREE.Quaternion();
    }
};

class XRFingerState {

    constructor(handScrollState, nameFinger, isThumb=false) {
        this.name = nameFinger;
        this.handScrollState = handScrollState;
        this.isThumb = isThumb;
        this.nameFinger = nameFinger;
        this.jointWrist = new XRFingerJoint(this, "-metacarpal");
        this.jointDistal = new XRFingerJoint(this, "-phalanx-proximal" );
        this.jointBend = new XRFingerJoint(this, isThumb ? "-phalanx-distal" : "-phalanx-intermediate");
        this.jointTip = new XRFingerJoint(this, "-tip");
        this.joints = [ this.jointWrist, this.jointProximal, this.jointDistal, this.jointTip ];
    }
};

class XRHandScrollCursor {
    constructor(handScrollState) {
        this.handScrollState = handScrollState;

    }
};

class XRHandScrollState {

    constructor(handSource, isRightHand) {
        this.handSource = handSource;
        this.isRightHand = isRightHand;
        this.fingerThumb = new XRFingerState(this, "thumb");
        this.fingerIndex = new XRFingerState(this, "index-finger");
        this.fingerMiddle = new XRFingerState(this, "middle-finger");
        this.fingerRing = new XRFingerState(this, "ring-finger");
        this.fingerPinky = new XRFingerState(this, "pinky-finger");
        this.fingers = [ this.fingerThumb, this.fingerIndex, this.fingerMiddle,
            this.fingerRing, this.fingerPinky ];
        this.cursor = new XRHandScrollCursor(this);
    }
};

class XRArmsScrollState {
    constructor(headSource, handSourceLeft, handSourceRight) {
        this.head = headSource;
        this.left = new XRHandScrollState(handSourceLeft, false);
        this.right= new XRHandScrollState(handSourceRight, true);
    }
};

export {
    XRArmsScrollState,
    XRHandScrollState,
    XRFingerState,
    XRHandScrollCursor,
};

