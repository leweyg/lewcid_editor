import { UIListbox, UIPanel, UIRow, UISelect, UISpan, UIText, UIInput, UIButton, UIProgress, UIRange } from './libs/ui.js';

import { FolderUtils } from "./FolderUtils.js"

function SidebarFolder( editor ) {

	//var mCurrentPath = "../../examples/models/gltf/";
	var mCurrentPath = "../examples/models/obj/spacekit/";
	var mSearchString = "";

	if (FolderUtils.IsLocalHost()) {
		//mCurrentPath = "../" + mCurrentPath;
	}

	const config = editor.config;
	const strings = editor.strings;

	const container = new UISpan();

	const settings = new UIPanel();
	settings.setBorderTop( '0' );
	settings.setPaddingTop( '20px' );
	container.add( settings );

	var refreshRow = new UIRow();
	const refreshButton = new UIButton("RELOAD IF NOT LOADING....");
	refreshRow.add( refreshButton );
	settings.add( refreshRow );
	refreshButton.onClick(() => {
		checkUrlParameters();
	});
	function clearReloadButton() {
		if (refreshRow) {
			settings.remove(refreshRow);
			refreshRow = null;
		}
	}
	if (!FolderUtils.GetFilePathInURL()) {
		clearReloadButton();
	}
	

	// folder tools:
	if (FolderUtils.IsLocalHost()) {
		// changeOption
		const folderTools = {
			'none' : "Git/Tools..",
			'pwd' : "Current Directory",
			'git_clone' : "Git Clone...",
			'git_status' : "Git Status",
			'custom_select_file' : "Custom: Select File",
			'custom_match_files' : "Custom: Match files",
			'custom_common_materials' : "Custom: Common Material",
			'file_list_update' : "Update file list",
		};
		const toolsRow = new UIRow();
		const toolsOption = new UISelect().setWidth( '150px' );
		toolsRow.add(toolsOption);
		toolsOption.setOptions( folderTools );
		toolsOption.setValue( 'none' );
		toolsOption.onChange(() => {
			var toolId = toolsOption.getValue();
			switch (toolId) {
				case 'pwd':
					FolderUtils.ShellExecute("pwd",(res) => {
						alert(res);
					});
					break;
				case 'git_clone':
					var path = prompt("Git source URL? SSH or .git:");
					if (path != "") {
						FolderUtils.ShellExecute("git clone " + path,(res) => {
							alert(res);
						});
					}
					break;
				case 'git_status':
					FolderUtils.ShellExecute("git status",(res) => {
						alert(res);
					});
					break;
				case 'file_list_update':
					//var folder = FolderUtils.PathParentFolder( FolderUtils.GetFilePathInURL() );
					var folder = "../examples/models/";

					FolderUtils.BuildFileListLocal(folder,(res) => {
						var fullRes = {"examples/":{"models/":res}};
						var fullText = JSON.stringify(fullRes, null, 2);
						var savePath = "../file_tree.json";
						FolderUtils.ShellSaveToFile(savePath, fullText, (res)=>{
							alert("Updated = " + res.trim());
						});
					});
					break;
				case 'custom_match_files':
					function copySingleFile(folderPath,shortName) {
						var from = folderPath + "obj_src/" + shortName + ".*";
						var to = folderPath + "obj/";
						FolderUtils.ShellExecute("cp " + from + " " + to,(res)=>{
						});
					}
					function customMatchFiles(folderPath) {
						FolderUtils.GetFilesInPath(folderPath + "gltf/",(sourceList)=>{
							for (var ndx in sourceList) {
								var sourceFile = sourceList[ndx];
								var oldPrefix = ".gltf.glb";
								if (sourceFile.endsWith(oldPrefix)) {
									sourceFile = sourceFile.replace(".gltf.glb","");
									copySingleFile(folderPath,sourceFile);
								}
							}
						});
					}
					customMatchFiles(FolderUtils.PathParentFolder(FolderUtils.GetFilePathInURL()));
					break;
				case 'custom_common_materials':
					{
						var folder = FolderUtils.PathParentFolder(FolderUtils.GetFilePathInURL());
						FolderUtils.GetFilesInPath(folder, (files) => {
							var materialsByName = {};
							var matsInFile = async function(path) {
								var text = await FolderUtils.DownloadTextAsync(path);
								var lines = text.split("\n");
								var mtls = {};
								var current = null;
								for (var li in lines) {
									var line = lines[li];
									if (line.startsWith("newmtl")) {
										var name = line.split(" ")[1].trim();
										var mtl = {
											name : name,
											lines : []
										}
										current = mtl;
										if (!(name in materialsByName)) {
											materialsByName[name] = mtl;
										}
									}
									if (current) {
										current.lines.push(line);
									}
								}
								return mtls;
							};
							var matPromises = [];
							for (var fi in files) {
								var path = folder + files[fi];
								if (path.endsWith(".mtl") && !path.includes("common.mtl")) {
									matPromises.push(matsInFile(path));
								}
							}
							Promise.all(matPromises).then(() => {
								var combined = "";
								for (var name in materialsByName) {
									var mat = materialsByName[name];
									for (var li in mat.lines) {
										combined += mat.lines[li] + "\n";
									}
									combined += "\n";
								}
								FolderUtils.ShellSaveToFile(folder + "common.mtl", combined);
							});
						});
					}
					break;
				case 'custom_select_file':
					function customSelectFile(fromFile) {
						var toPath = FolderUtils.PathParentFolder(fromFile) + "../../obj/";
						var fromPath = fromFile.replace(".obj",".*");
						FolderUtils.ShellExecute("cp " + fromPath + " " + toPath, (cmd)=>{

						});
					}
					customSelectFile(FolderUtils.GetFilePathInURL());
					break;
				default:
					break;
			}
			toolsOption.setValue( 'none' );
		});
		settings.add( toolsRow );
	}

	// current
	const currentRow = new UIRow();
	const currentOption = new UIInput(mCurrentPath);
	const upButton = new UIButton(" ▲Up ").setWidth("90px");
	upButton.onClick(() => {
		if (mSearchString != "") {
			setSearchString("");
			RefreshFolder();
			return;
		}
		if (mCurrentPath != "../") {
			var parentPath = FolderUtils.PathParentFolder(mCurrentPath);
			SetFolderPath(parentPath);
		}
	});
	currentRow.add(upButton);
	//currentRow.add( new UIText( strings.getKey( 'sidebar/folder/current' ) ).setWidth( '90px' ) );
	currentRow.add( currentOption );
	currentOption.onChange(() => {
		var to = currentOption.getValue();
		if (to != mCurrentPath) {
			mCurrentPath = to;
			RefreshFolder();
		}
	});
	settings.add( currentRow );

	// animation scrubber:
	const animRow = new UIRow();
	const animLabel = new UIText("Animation");
	animRow.add(animLabel);
	const animProgress = new UIRange(0.5, 0.0, 1.0, 0.01);
	animProgress.onChange(() => {
		animLabel.setValue("AnimTime=" + animProgress.getValue());
	});
	animRow.add(animProgress);
	settings.add( animRow );


	// search bar
	const searchRow = new UIRow();
	const searchBox = new UIInput("")
	searchBox.placeholder = "Search...";
	//searchRow.add( searchBox );
	//settings.add( searchRow );
	function updateFromSearchBox() {
		var val = searchBox.getValue();
		mSearchString = val;
		RefreshFolder();
	}
	function setSearchString(str) {
		searchBox.setValue(str);
		mSearchString = str;
		RefreshFolder();
	}
	searchBox.onInput(() => {
		updateFromSearchBox();
	});
	searchBox.onClick(() => {
		updateFromSearchBox();
	});

	// changeOption
	const changeDefaults = {
		'open' : "Open (replace)",
		'open_tab' : "Open in Tab",
		'add' : "Add to Scene",
	};
	const changeRow = new UIRow();
	const changeOption = new UISelect().setWidth( '150px' );
	changeOption.setOptions( changeDefaults );
	changeOption.setValue( 'open' );
	var getOpenMode = (() => {
		return changeOption.getValue();
	});
	var isOpenMode = (() => {
		return (getOpenMode() == 'open');
	});
	//changeRow.add( new UIText( strings.getKey( 'sidebar/folder/click' ) ).setWidth( '90px' ) );
	changeRow.add( changeOption );
	changeRow.add( searchBox );
	settings.add( changeRow );



	// Files in that folder:
	const filesRow = new UIRow();
	const filesList = new UIListbox();
	filesList.setItems( [ {name:"Loading " + mCurrentPath + "..."} ] );
	filesRow.add( filesList );
	settings.add( filesRow );

	// Global callbacks:

	var focusOnNextCommand = false;
	editor.signals.historyChanged.add( (cmd)=> {
		if ((!cmd) || (!(cmd.object))) return;

		if (!focusOnNextCommand) {
			return;
		}
		if (cmd.object.type == "DirectionalLight") {
			return;
		}
		focusOnNextCommand = false;

		//alert("Next command hit!");
		editor.focus(cmd.object);
	});

	// object selection
	editor.signals.objectSelected.add((obj) => {
		if (!obj) return;
		if ((mSearchString=="") && obj.userData && obj.userData.source) {
			searchBox.setValue( FolderUtils.PathDisplayName(obj.userData.source) );
		}
	});

	// Utility methods:

	function SetFolderPath(path) {
		mCurrentPath = path;
		RefreshFolder();
	}

	function RefreshFolder() {

		currentOption.setValue(mCurrentPath);

		FolderUtils.GetFilesInPath(mCurrentPath,(files) => {
			var file_list = [];
			for (var i in files) {
				var path = files[i].trim();
				if (path == "") continue;
				if (mSearchString != "") {
					if (!path.toLowerCase().includes(mSearchString.toLowerCase())) {
						continue;
					}
				}

				var item = {
					name : path,
					full_path : mCurrentPath + path,
					is_folder : path.endsWith("/"),
				};
				function add_on_click(to) {
					to.onClick = (() => {
						clearReloadButton();
						if (to.is_folder) {
							// change folder:
							mCurrentPath = to.full_path;
							RefreshFolder();
						} else {
							if (getOpenMode() == "open_tab") {
								var path = to.full_path;
								var url = "index.html?file_path=" + to.full_path;
								window.open( url, '_blank' );
								return;
							}
							// do import/open:
							if (isOpenMode()) {
								FolderUtils.SetDefaultScene(editor);
								FolderUtils.SetFilePathInURL(to.full_path);
								FolderUtils.SetTitleFromPath(to.full_path);
								focusOnNextCommand = true;
							}
							
							FolderUtils.ImportByPath(to.full_path, (blob) => {
								
							}, null, true);
							
						}
					});
				}
				add_on_click(item);

				file_list.push(item);
			}
			filesList.setItems(file_list);
		} );
	}

	RefreshFolder();
	var hasCheckedUrl = false;

	function checkUrlParameters() {
		if (hasCheckedUrl) {
			return;
		}
		hasCheckedUrl = true;

		clearReloadButton();
		var file_path = FolderUtils.GetFilePathInURL();
		if (!file_path) return;
		
		editor.clear();
		FolderUtils.SetDefaultScene(editor);
		FolderUtils.SetTitleFromPath(file_path);
		FolderUtils.ImportByPath(file_path, (obj) => {
			// editor.focus(obj);
		}, null, true);

		mCurrentPath = FolderUtils.PathParentFolder(file_path);
		RefreshFolder();
	}



	window.onload = (() => {
		setTimeout(()=>{
			checkUrlParameters();
		},100);
	});
	setTimeout(() => {
		checkUrlParameters();
	}, 2000);

	return container;

}

export { SidebarFolder };
