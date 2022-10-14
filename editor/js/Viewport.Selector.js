class Selector {

	constructor( editor ) {

		const signals = editor.signals;

		this.editor = editor;
		this.signals = signals;

		// signals

		signals.intersectionsDetected.add( ( intersects ) => {

			if ( intersects.length > 0 ) {

				const object = intersects[ 0 ].object;

				const better = this.refineSelection( object );

				this.select( better );

			} else {

				this.select( null );

			}

		} );

	}

	refineSelection ( object ) {
		if ( object.userData.object !== undefined ) {
			// select based on userData.object:
			return object.userData.object;
		}
		var better = object;
		for (var parent = object; parent; parent = parent.parent) {
			// find top most parent which is a "source":
			if (parent.userData && parent.userData.source) {
				better = parent;
			}
		}
		return better;
	}

	select( object ) {

		if ( this.editor.selected === object ) return;

		let uuid = null;

		if ( object !== null ) {

			uuid = object.uuid;

		}

		this.editor.selected = object;
		this.editor.config.setKey( 'selected', uuid );

		this.signals.objectSelected.dispatch( object );

	}

	deselect() {

		this.select( null );

	}

}

export { Selector };
