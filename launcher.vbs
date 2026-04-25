Set objFSO = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
strPath = objFSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run chr(34) & strPath & "\launcher.bat" & chr(34), 0
Set WshShell = Nothing
