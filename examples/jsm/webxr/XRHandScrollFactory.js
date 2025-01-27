
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

var XRHandPoses = {
    unknown:"unknown",
    inactive:"inactive",
    open:"open",
    pointing:"pointing",
    closed:"closed",
    plane_vertical:"plane_vertical",
    plane_side:"plane_side",
    plane_facing:"plane_facing",
    pinch_near:"pinch_near",
    pinch_active:"pinch_active",
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
        this.handPosesByName = XRHandPoses;
        // state:
        this.handFound = false;
        this.palmAlong = new THREE.Vector3(); // along index finger
        this.palmFacing = new THREE.Vector3();
        this.palmIsDown = false;
        this.palmIsToSide = false;
        this.pinchDistance = 10.0;
        this.pinchNear = false;
        this.pinchActive = false;
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

            this.palmIsDown = Math.abs( this.palmFacing.dot(this.arms.headUp) ) > 0.5;
            this.palmIsToSide = Math.abs( this.palmFacing.dot(this.arms.headRight) ) > 0.5;

            this.dv1.copy(this.fingerIndex.jointTip.position);
            this.dv2.copy(this.fingerThumb.jointTip.position);
            this.pinchDistance = this.dv1.distanceTo(this.dv2);
            this.pinchNear = (this.pinchDistance < 0.04);
            this.pinchActive = (this.pinchDistance < 0.02);
        }
        // Pose
        if (this.handFound) {
            this.handPose = this.handPosesByName.inactive;
            var ringIn = this.fingerRing.isContracted();
            var ringOut = this.fingerRing.isProtracted();
            var indexIn = this.fingerIndex.isContracted();
            var indexOut = this.fingerIndex.isProtracted();
            if (indexIn && this.pinchActive) {
                this.handPose = this.handPosesByName.pinch_active;
            } else if (ringIn && !indexIn) {
                this.handPose = this.handPosesByName.pointing;
            } else if (ringOut && indexOut && this.palmIsDown) {
                this.handPose = this.handPosesByName.plane_vertical;
            } else if (ringOut && (!indexIn) && this.palmIsToSide) {
                this.handPose = this.handPosesByName.plane_side;
            } else if (ringIn && indexIn && this.palmIsToSide) {
                this.handPose = this.handPosesByName.plane_facing;
            } else if (ringIn && indexIn && !this.palmIsToSide) {
                this.handPose = this.handPosesByName.closed;
            } else if (ringIn && this.pinchNear) {
                this.handPose = this.handPosesByName.pinch_near;
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


class XRHandScrollCursor {
    constructor(handScrollState) {
        // sources:
        this.handScrollState = handScrollState;
        // state:
        this.cursorShowing = false;
        this.cursorOffsetShowing = false;
        this.cursorOffsetByAxis = false;
        this.cursorCurrentHandPose = XRHandPoses.unknown;
        this.cursorStartPosition = new THREE.Vector3();
        this.cursorPosition = new THREE.Vector3();
        this.cursorAxes = new THREE.Vector3(1,1,1);
        this.cursorOffset = new THREE.Vector3();
        this.cursorOffsetPrevious = new THREE.Vector3();
        this.cursorOffsetDelta = new THREE.Vector3();
        this.cursorOffsetScale = 1.0;
        this.cursorOffsetMotion = 0.0;
        this.cursorForward = new THREE.Vector3(0,0,-1);
        this.cursorUp = new THREE.Vector3(0,1,0);
        this.cursorCubeCenter = new THREE.Vector3();
        this.cursorCubeOffset = new THREE.Vector3();
        this.cursorScale = 0.02;
        this.cursorCubeScale = new THREE.Vector3(this.cursorScale, this.cursorScale, this.cursorScale);
        this.cursorCubeRotation = new THREE.Euler();
        
        this.debugCursor = null;
        this.debugOffsetCursor = null;
        // temp vectors:
        this.dv1 = new THREE.Vector3();
        this.dv2 = new THREE.Vector3();
        this.dv3 = new THREE.Vector3();
    }

    updateCursorFromSource() {
        // basic state:
        var hand = this.handScrollState;
        var arms = hand.armState;
        var found = hand.handFound;
        this.cursorShowing = found;
        if (!found) {
            this.updateDebugCursor();
            return;
        }

        var poseChanged = false;
        if (this.cursorCurrentHandPose != hand.handPose) {
            this.cursorCurrentHandPose = hand.handPose;
            poseChanged = true;
        }
        
        // cursor setup:
        if ((hand.handPose == XRHandPoses.inactive) ||
            (hand.handPose == XRHandPoses.unknown) ||
            (hand.handPose == XRHandPoses.open))
        {
            this.cursorShowing = false;
            this.cursorOffsetShowing = false;
            this.cursorOffsetByAxis = false;
        } else if (hand.handPose == XRHandPoses.pointing) {
            this.cursorOffsetShowing = false;
            this.cursorOffsetByAxis = false;
            this.cursorPosition.copy(hand.fingerIndex.jointTip.position);
            this.cursorCubeScale.set(1,1,1).multiplyScalar(this.cursorScale);
        } else if ((hand.handPose == XRHandPoses.pinch_near) ||
                (hand.handPose == XRHandPoses.pinch_active))
        {
            this.cursorOffsetShowing = true;
            this.cursorOffsetByAxis = false;
            this.dv1.copy(hand.fingerIndex.jointTip.position);
            this.dv2.copy(hand.fingerThumb.jointTip.position);
            this.dv3.copy(this.dv1).add(this.dv2).multiplyScalar(0.5);
            var scl = hand.pinchActive ? 0.05 : (hand.pinchDistance * 2.0);

            this.cursorPosition.copy(this.dv3);
            this.cursorCubeScale.set(1,1,1).multiplyScalar(scl);
        } else if ((hand.handPose == XRHandPoses.plane_vertical) ||
            (hand.handPose == XRHandPoses.plane_facing) ||
            (hand.handPose == XRHandPoses.plane_side))
        {
            this.cursorOffsetShowing = true;
            this.cursorOffsetByAxis = true;
            this.cursorPosition.copy(hand.fingerIndex.jointProximal.position);
            var planeAxis = "x";
            switch (hand.handPose) {
                case XRHandPoses.plane_vertical:
                    planeAxis = "y";
                    break;
                case XRHandPoses.plane_side:
                    planeAxis = "x";
                    break;
                case XRHandPoses.plane_facing:
                    planeAxis = "z";
                    break;
            }
            var largeScale = 0.20;
            this.dv1.set(1,1,1).multiplyScalar(largeScale);
            this.dv1[planeAxis] = this.cursorScale;
            this.cursorCubeScale.copy(this.dv1);
            this.cursorAxes.set(0,0,0);
            this.cursorAxes[planeAxis] = 1.0;
        } else if (hand.handPose == XRHandPoses.closed) {
            this.cursorOffsetShowing = true;
            this.cursorOffsetByAxis = false;
            this.cursorPosition.copy(hand.fingerIndex.jointProximal.position);
            var closedScale = 0.1;
            this.cursorCubeScale.set(closedScale, closedScale, closedScale);
        } else {
            this.cursorOffsetShowing = false;
            this.cursorPosition.copy(hand.fingerIndex.jointTip.position);
            this.cursorCubeScale.set(1,this.cursorScale,this.cursorScale);
        }
        this.cursorCubeCenter.copy(this.cursorPosition); // offset?

        // offset:
        if (poseChanged) {
            this.resetCursorStartPosition();
        }

        if (this.cursorOffsetShowing) {
            this.dv1.copy(this.cursorPosition);
            this.dv1.sub(this.cursorStartPosition);
            if (this.cursorOffsetByAxis) {
                var along = this.dv1.dot(this.cursorAxes);
                this.cursorOffset.copy(this.cursorAxes);
                this.cursorOffset.multiplyScalar(-along);
                this.cursorOffsetScale = 2.0;
                this.cursorOffsetMotion = 1.0;
            } else {
                this.dv1.multiplyScalar(-1.0);
                this.cursorOffset.copy(this.dv1);
                this.cursorOffsetScale = 1.0;

                var isPinch = (hand.handPose == XRHandPoses.pinch_active);
                this.cursorOffsetMotion = (isPinch ? 0.0 : 1.0);
            }
            this.cursorCubeOffset.copy(this.cursorCubeCenter);
            this.cursorCubeOffset.add(this.cursorOffset);
        }
        if (poseChanged) {
            this.cursorOffsetPrevious.copy(this.cursorOffset);
        }
        this.cursorOffsetDelta.copy(this.cursorOffset);
        this.cursorOffsetDelta.sub(this.cursorOffsetPrevious);
        this.cursorOffsetPrevious.copy(this.cursorOffset);


        this.cursorForward.copy(hand.palmAlong);
        this.cursorUp.copy(hand.palmFacing);

        // debug:
        this.updateDebugCursor();
    }

    resetCursorStartPosition() {
        this.cursorStartPosition.copy(this.cursorPosition);
    }

    updateDebugCursor() {
        var tools = this.handScrollState.arms.debugTools;
        if (!tools) return;
        if (!this.debugCursor) {
            this.debugCursor = tools.createDebugBox();
            this.debugCursor.name = this.handScrollState.handName + "-cursor";
            this.debugCursor.material = tools.commonCursorMat;

            this.debugOffsetCursor = tools.createDebugBox();
            this.debugOffsetCursor.name = this.handScrollState.handName + "-offset-cursor";
            this.debugOffsetCursor.material = tools.commonCursorMat;
        }
        this.debugCursor.position.copy(this.cursorCubeCenter);
        this.debugCursor.rotation.copy(this.cursorCubeRotation);
        this.debugCursor.scale.copy(this.cursorCubeScale);
        this.debugCursor.visible = this.cursorShowing;

        this.debugOffsetCursor.position.copy(this.cursorCubeOffset);
        this.debugOffsetCursor.rotation.copy(this.cursorCubeRotation);
        this.debugOffsetCursor.scale.copy(this.cursorCubeScale);
        this.debugOffsetCursor.visible = this.cursorOffsetShowing;
    }
};

class Tiling3D {
    constructor() {
        // settings:
        this.unitBox = new THREE.Box3(new THREE.Vector3(-1,-1,-1), new THREE.Vector3(1,1,1));
        this.outputBox = this.unitBox.clone();
        this.outputBox.min.y = 0;
        this.outputBox.max.y = 2;

        this.tilingStart = new THREE.Vector3(-1,-1,-1);
        this.tilingMin = new THREE.Vector3(-1,-1,-1);
        this.tilingMax = new THREE.Vector3(1,1,1);
        this.tilingStep = new THREE.Vector3(0.5, 0.5, 0.5);
        this.tilingSpan1d = 0.5;
        this.tilingSpan1dRaw = 0.5;
        this.tilingSpanShowPct = 1.0
        this.tilingAxisResolution = 4;

        this.dvIter = new THREE.Vector3();
        this.dvCur = new THREE.Vector3();
        this.dv1 = new THREE.Vector3();
        this.dv2 = new THREE.Vector3();
        this.dv3 = new THREE.Vector3();
    }

    iterStart() {
        this.dvIter.copy(this.tilingStart);
        return this.dvIter;
    }

    iterTryStep() {
        var res = this.iterateVolume(this.dvIter, this.tilingMin, this.tilingMax, this.tilingStep );
        return res;
    }

    vec3Floor(v) {
        v.x = Math.floor(v.x);
        v.y = Math.floor(v.y);
        v.z = Math.floor(v.z);
    }

    roundDownToStep(pos) {
        this.dv2.copy(pos);
        this.dv2.divide(this.tilingStep);
        this.vec3Floor(this.dv2);
        this.dv2.multiply(this.tilingStep);

        pos.copy(this.dv2);
    }

    lowerPowerOf2(v) {
        v = Math.abs(v);
        if (v == 1) {
            return 0.5;
        }
        var goal = 1;
        var stepMax = 10;
        var stepCur = 0;
        while (stepCur < stepMax) {
            stepCur++;
            var next = goal;
            if (v <= 1) {
                if (next > v) {
                    next *= 0.5;
                } else {
                    break;
                }
            } else {
                if (next < v) {
                    next *= 2.0;
                    if (next > v) {
                        break;
                    }
                } else {
                    break;
                }
            }
            goal = next;
        }
        return goal;
    }

    updateTilingStart(offsetScene,resScale=1) {
        this.tilingMin.copy(this.outputBox.min);
        offsetScene.worldToLocal(this.tilingMin);
        this.tilingMax.copy(this.outputBox.max);
        offsetScene.worldToLocal(this.tilingMax);

        this.roundDownToStep(this.tilingMin);
        this.tilingStart.copy(this.tilingMin);

        var span = this.tilingMax.x - this.tilingMin.x;
        var rawStep = span / this.tilingAxisResolution;
        var flooredStep = this.lowerPowerOf2( rawStep ) * resScale;
        this.tilingSpan1d = flooredStep;
        this.tilingSpan1dRaw = rawStep;
        this.tilingStep.set(flooredStep,flooredStep,flooredStep);
    }

    iterateVolume(vecCur, vecMin, vecMax, vecIter) {
        vecCur.x += vecIter.x;
        if (vecCur.x > vecMax.x) {
            vecCur.x = vecMin.x;

            vecCur.y += vecIter.y;
            if (vecCur.y > vecMax.y) {
                vecCur.y = vecMin.y;

                vecCur.z += vecIter.z;
                if (vecCur.z > vecMax.z) {
                    vecCur.z = vecMin.z;
                    return false;
                }
            }
        }
        return true;
    }
};

class XRArmScroller {
    constructor(arms, targetScene) {
        // sources:
        this.arms = arms;
        this.target = targetScene;
        this.cursors = [ this.arms.handLeft.cursor, this.arms.handRight.cursor ];
        // state:
        this.timeNow = new Date();
        this.timePrev = this.timeNow;
        this.timeDelta = 0.0;
        this.motionDir = new THREE.Vector3();
        this.debugTarget = null;
        this.debugContent = null;
        this.debugContentPoints = [];
        this.debugTiling = new Tiling3D();
        this.debugTiling2 = new Tiling3D();
        this.debugTilingsAll = [ this.debugTiling, this.debugTiling2 ];
        this.zoomActive = false;
        this.zoomPrevious = 1.0;
        this.zoomLatest = new THREE.Vector3();
        this.zoomKeepLocal = new THREE.Vector3();
        this.zoomKeepWorld = new THREE.Vector3();
        this.zoomScalarMotion = 1.0;
        this.zoomTargetMatrixInitial = new THREE.Matrix4();

        // temp vectors:
        this.dv1 = new THREE.Vector3();
        this.dv2 = new THREE.Vector3();
        this.dv3 = new THREE.Vector3();
        this.dq1 = new THREE.Quaternion();
        this.dm1 = new THREE.Matrix4();
        this.dm2 = new THREE.Matrix4();
        this.dm3 = new THREE.Matrix4();
    }

    matrixFromPoints(matInto, vecA, vecB)
    {
        this.dv1.copy(vecB);
        this.dv1.sub(vecA);
        this.dv1.y = 0; // for now
        this.dv1.z = 0; // for now

        var sclDir = this.dv1.length();
        this.dv2.copy(this.dv1);
        this.dv2.normalize();
        this.dv3.set(0,0,-1);
        this.dq1.setFromUnitVectors(this.dv3, this.dv2);
        this.dv1.set(1,1,1).multiplyScalar(sclDir);

        matInto.identity().compose(vecA, this.dq1, this.dv1);
    }

    updateScroller() {
        this.timeNow = new Date();
        this.timeDelta = (this.timeNow - this.timePrev) / 1000.0; // to seconds
        this.timePrev = this.timeNow;

        var zoomWasActive = this.zoomActive;
        var zoomStartedThisFrame = false;
        if (this.arms.armPose == XRArmPoses.pinching_pair)
        {
            this.zoomActive = true;
        } else {
            this.zoomActive = false;
        }
        if (this.zoomActive && !zoomWasActive) {
            zoomStartedThisFrame = true;
            this.zoomTargetMatrixInitial.copy(this.debugTarget.matrixWorld);
        }
        var anyHandsActive = false;
        if ((this.arms.armPose == XRArmPoses.hands_indepenant)
            || (this.arms.armPose == XRArmPoses.single_handed))
        {
            anyHandsActive = true;
        }

        this.motionDir.set(0,0,0);
        if (this.zoomActive)
        {
            var leftCursor = this.arms.handLeft.cursor;
            var rightCursor = this.arms.handRight.cursor;
            var keepPos = leftCursor.cursorPosition;
            
            if (zoomStartedThisFrame) {
                rightCursor.resetCursorStartPosition();
                leftCursor.resetCursorStartPosition();
                this.zoomKeepWorld.copy(keepPos);
                this.zoomKeepLocal.copy(this.zoomKeepWorld);
                this.debugTarget.worldToLocal(this.zoomKeepLocal);
            }

            this.matrixFromPoints(this.dm1,
                rightCursor.cursorStartPosition,
                leftCursor.cursorStartPosition);
            this.dm1.invert();

            this.matrixFromPoints(this.dm2,
                rightCursor.cursorPosition,
                leftCursor.cursorPosition);

            this.dm3.copy( this.zoomTargetMatrixInitial );
            this.dm3.multiply(this.dm1);
            this.dm3.multiply(this.dm2);

            this.dm1.copy(this.debugTarget.matrixWorld);
            this.dm1.invert();
            this.dm1.multiply(this.dm3);
            this.debugTarget.applyMatrix4(this.dm1);
            this.debugTarget.updateMatrixWorld();

            this.dv2.copy(this.zoomKeepLocal);
            this.debugTarget.localToWorld(this.dv2);
            this.dv2.sub(keepPos);
            this.dv2.multiplyScalar(-1);
            this.debugTarget.position.add(this.dv2);

        } else if (anyHandsActive) {
            for (var i in this.cursors) {
                var cursor = this.cursors[i];
                if (cursor.cursorOffsetShowing) {
                    if (cursor.handScrollState.handPose == XRHandPoses.closed) {
                        this.dv1.copy(cursor.cursorOffset);
                        var scrollSpeed = -3.0;
                        this.dv1.multiplyScalar(scrollSpeed * this.timeDelta);
                    } else {
                        this.dv1.copy(cursor.cursorOffsetDelta);
                        this.dv1.multiplyScalar(-cursor.cursorOffsetScale);

                        // hack:
                        this.dv2.copy(cursor.cursorOffset);
                        var scrollSpeed = -2.0 * cursor.cursorOffsetMotion;
                        this.dv2.multiplyScalar(scrollSpeed * this.timeDelta);
                        this.dv1.add(this.dv2);
                    }
                    this.motionDir.add(this.dv1);
                }
            }
            if (this.target && (this.motionDir.length() > 0)) {
                this.target.position.add(this.motionDir);
            }
            if (this.debugTarget && (this.motionDir.length() > 0)) {
                this.debugTarget.position.add(this.motionDir);
            }
        }
    
        // end of update:
        this.updateDebugScroller();
    }

    updateDebugScroller() {
        var tools = this.arms.debugTools;
        if (!tools) return;
        if (!this.debugTarget) {
            
            if (this.target) {
                this.debugTarget = this.target;
            } else {
                this.debugTarget = new THREE.Group();
                this.arms.debugTools.debugScene.add(this.debugTarget);
            }

            this.debugContent = new THREE.Group();
            this.debugTarget.add(this.debugContent);
        }

        this.debugTiling.updateTilingStart(this.debugTarget);
        this.debugTiling2.updateTilingStart(this.debugTarget, 2.0);
        var midSpan = (this.debugTiling2.tilingSpan1d + this.debugTiling.tilingSpan1d) * 0.5;
        this.debugTiling.tilingSpanShowPct = (
            1.0 - (Math.abs(this.debugTiling.tilingSpan1dRaw - this.debugTiling.tilingSpan1d)
            / Math.abs(1 * this.debugTiling.tilingSpan1d)));
        this.debugTiling2.tilingSpanShowPct = 1.0 - this.debugTiling.tilingSpanShowPct;

        // update debug boxes:
        var writeBox = 0;
        var boxScaleToStep = 0.05;

        for (var ti in this.debugTilingsAll) {
            var tiling = this.debugTilingsAll[ti];
            var mat = this.arms.debugTools.commonScrollableMats[ti];
            mat.opacity = 0.5 * tiling.tilingSpanShowPct;
            this.dv3.copy(tiling.tilingStep);
            this.dv3.multiplyScalar(boxScaleToStep);
            for (var vecCur=tiling.iterStart(); tiling.iterTryStep(); ) {
                var box = null;
                if (writeBox == this.debugContentPoints.length) {
                    box = this.arms.debugTools.createDebugBox(this.debugContent);
                    var scl = 0.01;
                    box.scale.set(1,1,1).multiplyScalar(scl);
                    box.material = this.arms.debugTools.commonScrollableMat;
                    this.debugContentPoints.push(box);
                    this.debugContent.add(box);
                    writeBox++;
                } else {
                    box = this.debugContentPoints[writeBox];
                    box.visible = true;
                    writeBox++;
                }
                box.position.copy(vecCur);
                box.scale.copy(this.dv3);
                box.material = mat;
            }
        }
        // hide unused boxes:
        while (writeBox < this.debugContentPoints.length) {
            this.debugContentPoints[writeBox].visible = false;
            writeBox++;
        }

    }
};

class HandScrollDebugTools {
    constructor(armState, debugScene) {
        this.armState = armState;
        this.debugScene = debugScene;

        var scl = 1.0;
        this.commonBoxGeo = new THREE.BoxGeometry( scl, scl, scl ); 
        this.commonCursorMat = new THREE.MeshStandardMaterial( {color: 0x00FF00,transparent:true,opacity:0.5});
        this.commonScrollableMat = new THREE.MeshStandardMaterial( {color: 0x0000ff,transparent:true,opacity:0.5});
        this.commonScrollableMatLower = new THREE.MeshStandardMaterial( {color: 0x0000ff,transparent:true,opacity:0.5});
        this.commonScrollableMatUpper = new THREE.MeshStandardMaterial( {color: 0x0000ff,transparent:true,opacity:0.5});
        this.commonScrollableMats = [
            this.commonScrollableMatLower,
            this.commonScrollableMatUpper ];
        this.commonMat = new THREE.MeshPhysicalMaterial( {color: 0x778877} );
        this.commonRed = new THREE.MeshPhysicalMaterial( {color: 0xFF0000} );
        this.commonBlue = new THREE.MeshPhysicalMaterial( {color: 0x0000FF} );
    }

    createDebugBox(customParent=null) {
        const cube = new THREE.Mesh( this.commonBoxGeo, this.commonMat );
        if (customParent) {
            customParent.add(cube);
        } else {
            this.debugScene.add(cube);
        }
        return cube;
    }
};


var XRArmPoses = {
    unknown : "unknown",
    inactive : "inactive",
    single_handed : "single_handed",
    hands_indepenant : "hands_indepenant",
    pinching_pair : "pinching_pair",
    planes_side : "planes_side",
    planes_vertical : "planes_vertical",
    planes_facing : "planes_facing",
};

class XRArmsScrollState {

    constructor(headSource, handSourceLeft, handSourceRight, debugScene, targetScroller) {
        // sources:
        this.head = headSource;
        this.debugTools = debugScene ? (new HandScrollDebugTools(this, debugScene)) : null;
        this.handLeft = new XRHandScrollState(this, handSourceLeft, false);
        this.handRight = new XRHandScrollState(this, handSourceRight, true);
        this.hands = [ this.handLeft, this.handRight ];
        this.scroller = new XRArmScroller(this, targetScroller);
        // state:
        this.headForward = new THREE.Vector3(0,0,-1);
        this.headUp = new THREE.Vector3(0,1,0);
        this.headRight = new THREE.Vector3(1,0,0);
        this.armPose = XRArmPoses.unknown;
        this.armPoseChanged = false;
    }

    updateArmsFromSource() {
        for (var i in this.hands) {
            var hand = this.hands[i];
            hand.updateHandFromSource();
        }
        // update dual-hand arm pose:
        function handPoseRelevant(handPose) {
            switch (handPose) {
                case XRHandPoses.unknown:
                case XRHandPoses.inactive:
                case XRHandPoses.open:
                    return false;
                default:
                    return true;
            }
        }
        function handPosesPairing(poseA,poseB) {
            if (poseA == poseB) {
                if (poseA == XRHandPoses.pinch_active) return XRArmPoses.pinching_pair;
            }
            return XRArmPoses.hands_indepenant;
        }
        var leftPose = this.handLeft.handPose;
        var rightPose = this.handRight.handPose;
        var leftRelevant = handPoseRelevant(leftPose);
        var rightRelevant = handPoseRelevant(rightPose);
        var armPosePrevious = this.armPose;
        this.armPose = XRArmPoses.unknown;
        if ((!leftRelevant) && (!rightRelevant)) {
            this.armPose = XRArmPoses.inactive;
        } else if (leftRelevant != rightRelevant) {
            this.armPose = XRArmPoses.single_handed;
        } else if (leftRelevant && rightRelevant) {
            this.armPose = handPosesPairing(leftPose, rightPose);
        }
        this.armPoseChanged = (armPosePrevious != this.armPose);

        // then update scroller:
        this.scroller.updateScroller();
    }
};

export {
    XRArmsScrollState,
    XRArmScroller,

    XRHandScrollState,
    XRHandPoses,
    XRFingerState,
    XRHandScrollCursor,
};

