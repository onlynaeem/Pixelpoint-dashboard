using System;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Diagnostics;
using System.Windows.Forms;
class Bootstrap {
 [STAThread] static void Main(string[] args) {
  Application.EnableVisualStyles();
  string temp=Path.Combine(Path.GetTempPath(),"PixelPointSetup-"+Guid.NewGuid().ToString("N"));
  try {
   Directory.CreateDirectory(temp);
   string zip=Path.Combine(temp,"payload.zip");
   using(var src=Assembly.GetExecutingAssembly().GetManifestResourceStream("payload.zip"))
   using(var dst=File.Create(zip)){src.CopyTo(dst);}
   ZipFile.ExtractToDirectory(zip,Path.Combine(temp,"payload"));
   var script=Path.Combine(temp,"payload","windows-setup","Setup.ps1");
   var info=new ProcessStartInfo("powershell.exe","-NoProfile -ExecutionPolicy Bypass -File \""+script+"\"");
   info.UseShellExecute=false;info.CreateNoWindow=true;
   using(var process=Process.Start(info)){process.WaitForExit();if(process.ExitCode!=0)MessageBox.Show("Setup did not complete. Check the installation folder and try again.","PixelPoint Setup");}
  }catch(Exception ex){MessageBox.Show(ex.Message,"PixelPoint Setup failed");}
  finally{try{Directory.Delete(temp,true);}catch{}}
 }
}
