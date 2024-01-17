
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
        this.debugFingerJoint = null;
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
        //this.updateDebugJoint();
        return this.found;
    }

    updateDebugJoint() {
        var tools = this.fingerState.handScrollState.arms.debugTools;
        if (!tools) return;
        if (!this.debugFingerJoint) {
            var scl = 0.01;
            this.debugFingerJoint = tools.createDebugBox();
            this.debugFingerJoint.scale.set(scl, scl, scl);
            this.debugFingerJoint.name = this.fingerState.handScrollState.handName + "-" + this.jointName;
        }
        this.debugFingerJoint.position.copy(this.position);
        this.debugFingerJoint.rotation.copy(this.rotation);
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
        this.debugSegments = null;
        this.debugMaterials = null;
        // state:
        this.fingerFound = false;
        this.fingerSide = new THREE.Vector3();
        this.fingerUp = new THREE.Vector3();
        this.tendonAngleMin = 0.35; //Math.PI / 8.0;
        this.tendonAngleMax = 1.25; // Math.PI / 2.0;
        this.tendonAngle = (this.tendonAngleMin + this.tendonAngleMax) * 0.5;
        this.tendonState = 0; // -1 for contracted, 1 for protracted
        // temp vectors:
        this.dv1 = new THREE.Vector3();
        this.dv2 = new THREE.Vector3();
        this.dv3 = new THREE.Vector3();
    }

    isContracted() {
        return (this.tendonState < 0);
    }

    isProtracted() {
        return (this.tendonState > 0);
    }

    isRelaxed() {
        return (this.tendonState == 0);
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

        // general finger math:
        this.dv1.copy(this.jointProximal.position);
        this.dv1.sub(this.jointWrist.position);
        this.dv2.copy(this.jointTip.position);
        this.dv2.sub(this.jointProximal.position);
        this.fingerSide.crossVectors(this.dv2, this.dv1);
        this.fingerUp.crossVectors(this.fingerSide, this.dv1);

        // calculate tensor state:
        this.tendonAngle = this.dv1.angleTo(this.dv2);
        if (this.tendonAngle < this.tendonAngleMin) {
            this.tendonState = 1;
        } else if (this.tendonAngle > this.tendonAngleMax) {
            this.tendonState = -1;
        } else {
            this.tendonState = 0;
        }

        // result:
        this.updateDebugFinger();
        return this.fingerFound;
    }

    updateDebugFinger() {
        var tools = this.handScrollState.arms.debugTools;
        if (!tools) return;
        if (!this.debugSegments) {
            this.debugSegments = [ null, null, null ];
            for (var i in this.debugSegments) {
                var seg = tools.createDebugBox();
                this.debugSegments[i] = seg;
                seg.name = this.handScrollState.handName + "-" + this.nameFinger;
            }
        }
        for (var i in this.debugSegments) {
            var line = this.debugSegments[i];
            line.up.copy(this.fingerUp);

            var from = this.joints[i];
            var to = this.joints[(1*i)+1];

            var dv1 = this.dv1;
            var dv2 = this.dv2;
            var dv3 = this.dv3;
            dv1.copy(from.position);
            dv1.add(to.position);
            
            dv1.multiplyScalar(0.5);
            line.position.copy(dv1);
            line.lookAt(to.position);

            dv1.copy(from.position);
            dv1.sub(to.position);
            var len = dv1.length();
            line.scale.set(0.01, 0.0161, len);

            if (this.tendonState < 0) {
                line.material = tools.commonRed;
            } else if (this.tendonState == 0) {
                line.material = tools.commonMat;
            } else {
                line.material = tools.commonBlue;
            }
        }
    }
};

class XRHandScrollCursor {
    constructor(handScrollState) {
        this.handScrollState = handScrollState;
        this.cursorShowing = false;
        this.cursorPosition = new THREE.Vector3();
        this.cursorForward = new THREE.Vector3(0,0,-1);
        this.cursorUp = new THREE.Vector3(0,1,0);
        this.cursorCubeCenter = new THREE.Vector3();
        this.cursorCubeScale = new THREE.Vector3(0.15,0.15,0.15);
        this.cursorCubeRotation = new THREE.Euler();
        this.debugCursor = null;
    }

    updateCursorFromSource() {


        this.updateDebugCursor();
    }

    updateDebugCursor() {
        var tools = this.handScrollState.arms.debugTools;
        if (!tools) return;
        if (!this.debugCursor) {
            this.debugCursor = tools.createDebugBox();
            this.debugCursor.name = this.handScrollState.handName + "-cursor";
        }
        this.debugCursor.position.copy(this.cursorCubeCenter);
        this.debugCursor.rotation.copy(this.cursorCubeRotation);
        this.debugCursor.visible = this.cursorShowing;
    }
};

class XRHandScrollState {

    constructor(arms, handSource, isRightHand) {
        // sources:
        this.arms = arms;
        this.handName = isRightHand ? "hand-right" : "hand-left";
        this.handSource = handSource;
        this.isRightHand = isRightHand;
        this.fingerThumb = new XRFingerState(this, "thumb", true);
        this.fingerIndex = new XRFingerState(this, "index-finger");
        this.fingerMiddle = new XRFingerState(this, "middle-finger");
        this.fingerRing = new XRFingerState(this, "ring-finger");
        this.fingerPinky = new XRFingerState(this, "pinky-finger");
        this.fingers = [ this.fingerThumb, this.fingerIndex, this.fingerMiddle,
            this.fingerRing, this.fingerPinky ];
        // constants (better way?):
        this.handPosesByName = {
            unknown:"unknown",
            inactive:"inactive",
            open:"open",
            pointing:"pointing",
            closed:"closed",
            plane_down:"plane_down",
            plane_side:"plane_side",
            plane_away:"plane_away",
            pinch_near:"pinch_near",
            pinch_active:"pinch_active",
        };
        // state:
        this.handFound = false;
        this.palmAlong = new THREE.Vector3(); // along index finger
        this.palmFacing = new THREE.Vector3();
        this.palmIsDown = false;
        this.palmIsIn = false;
        this.handPose = this.handPosesByName.unknown;
        this.cursor = new XRHandScrollCursor(this);
        // temp vectors:
        this.dv1 = new THREE.Vector3();
        this.dv2 = new THREE.Vector3();
        this.dv3 = new THREE.Vector3();
    }

    updateHandFromSource() {
        // Fingers:
        var anyMissing = false;
        for (var i in this.fingers) {
            var finger = this.fingers[i];
            if (!finger.updateFingerFromSource()) {
                anyMissing = true;
            }
        }
        this.handFound = !anyMissing;

        // Palm:
        if (this.handFound) {
            this.dv1.copy(this.fingerIndex.jointWrist.position);

            this.dv2.copy(this.fingerIndex.jointProximal.position);
            this.dv2.sub(this.dv1).normalize();
            this.palmAlong.copy(this.dv2);

            this.dv3.copy(this.fingerRing.jointProximal.position);
            this.dv3.sub(this.dv1).normalize();
            this.palmFacing.crossVectors(this.dv2, this.dv3).normalize();

            this.palmIsDown = this.palmFacing.dot(this.arms.headUp) < -0.5;
            this.palmIsIn = Math.abs( this.palmFacing.dot(this.arms.headRight) ) > 0.5;
        }
        // Pose
        if (this.handFound) {
            this.handPose = this.handPosesByName.inactive;
            var ringIn = this.fingerRing.isContracted();
            var ringOut = this.fingerRing.isProtracted();
            var indexIn = this.fingerIndex.isContracted();
            var indexOut = this.fingerIndex.isProtracted();
            if (ringIn && !indexIn) {
                this.handPose = this.handPosesByName.pointing;
            } else if (ringOut && indexOut) {
                this.handPose = this.handPosesByName.plane_down;
            }
        } else {
            this.handPose = this.handPosesByName.unknown;
        }

        // Cursor:
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

class HandScrollDebugTools {
    constructor(armState, debugScene) {
        this.armState = armState;
        this.debugScene = debugScene;

        var scl = 1.0;
        this.commonBoxGeo = new THREE.BoxGeometry( scl, scl, scl ); 
        this.commonMat = new THREE.MeshPhysicalMaterial( {color: 0x778877} );
        this.commonRed = new THREE.MeshPhysicalMaterial( {color: 0xFF0000} );
        this.commonBlue = new THREE.MeshPhysicalMaterial( {color: 0x0000FF} );
    }

    createDebugBox() {
        const cube = new THREE.Mesh( this.commonBoxGeo, this.commonMat );
        this.debugScene.add(cube);
        return cube;
    }
};

class XRArmsScrollState {
    constructor(headSource, handSourceLeft, handSourceRight, debugScene) {
        // sources:
        this.head = headSource;
        this.debugTools = debugScene ? (new HandScrollDebugTools(this, debugScene)) : null;
        this.handLeft = new XRHandScrollState(this, handSourceLeft, false);
        this.handRight = new XRHandScrollState(this, handSourceRight, true);
        this.hands = [ this.handLeft, this.handRight ];
        // state:
        this.headForward = new THREE.Vector3(0,0,-1);
        this.headUp = new THREE.Vector3(0,1,0);
        this.headRight = new THREE.Vector3(1,0,0);
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

